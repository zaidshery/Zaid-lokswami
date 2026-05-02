#!/usr/bin/env node

const crypto = require('crypto');
const path = require('path');

try {
  const dotenv = require('dotenv');
  const root = path.resolve(__dirname, '..');
  for (const file of ['.env', '.env.hostinger', '.env.production', '.env.local', '.env.production.local']) {
    dotenv.config({ path: path.join(root, file), override: false });
  }
} catch {
  // dotenv is optional for hosted environments that inject process.env.
}

const requiredEnv = [
  'DIGITALOCEAN_SPACES_ACCESS_KEY',
  'DIGITALOCEAN_SPACES_SECRET_KEY',
  'DIGITALOCEAN_SPACES_BUCKET',
  'DIGITALOCEAN_SPACES_REGION',
];

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

function assertEnv() {
  const missing = requiredEnv.filter((name) => !readEnv(name));
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function buildCanonicalUri(key) {
  return `/${key.split('/').map((segment) => encodeRfc3986(segment)).join('/')}`;
}

function buildCanonicalQuery(query) {
  return Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

function getSignatureKey(secretKey, dateStamp, region) {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function formatAmzDateParts(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${now.getUTCDate()}`.padStart(2, '0');
  const hours = `${now.getUTCHours()}`.padStart(2, '0');
  const minutes = `${now.getUTCMinutes()}`.padStart(2, '0');
  const seconds = `${now.getUTCSeconds()}`.padStart(2, '0');

  return {
    dateStamp: `${year}${month}${day}`,
    amzDate: `${year}${month}${day}T${hours}${minutes}${seconds}Z`,
  };
}

function getConfig() {
  const bucket = readEnv('DIGITALOCEAN_SPACES_BUCKET').toLowerCase();
  const region = readEnv('DIGITALOCEAN_SPACES_REGION').toLowerCase();

  return {
    accessKey: readEnv('DIGITALOCEAN_SPACES_ACCESS_KEY'),
    secretKey: readEnv('DIGITALOCEAN_SPACES_SECRET_KEY'),
    bucket,
    region,
    host: `${bucket}.${region}.digitaloceanspaces.com`,
    cdnBaseUrl: readEnv('DIGITALOCEAN_SPACES_CDN_BASE_URL'),
  };
}

function createPresignedPutUrl(config, key) {
  const now = new Date();
  const { dateStamp, amzDate } = formatAmzDateParts(now);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const canonicalUri = buildCanonicalUri(key);
  const signedHeaders = 'host;x-amz-acl';
  const query = buildCanonicalQuery({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKey}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': '600',
    'X-Amz-SignedHeaders': signedHeaders,
  });
  const canonicalHeaders = `host:${config.host}\nx-amz-acl:public-read\n`;
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    query,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = crypto
    .createHmac('sha256', getSignatureKey(config.secretKey, dateStamp, config.region))
    .update(stringToSign, 'utf8')
    .digest('hex');

  return `https://${config.host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

function createSignedObjectRequest(config, method, key) {
  const { dateStamp, amzDate } = formatAmzDateParts();
  const canonicalUri = buildCanonicalUri(key);
  const emptyHash = sha256Hex('');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = [
    `host:${config.host}`,
    `x-amz-content-sha256:${emptyHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n');
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    emptyHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = crypto
    .createHmac('sha256', getSignatureKey(config.secretKey, dateStamp, config.region))
    .update(stringToSign, 'utf8')
    .digest('hex');

  return {
    url: `https://${config.host}${canonicalUri}`,
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'x-amz-content-sha256': emptyHash,
      'x-amz-date': amzDate,
    },
  };
}

async function expectOk(label, response, allowedStatuses = []) {
  if (response.ok || allowedStatuses.includes(response.status)) {
    console.log(`PASS ${label}: ${response.status}`);
    return;
  }

  const text = await response.text().catch(() => '');
  throw new Error(`${label} failed with ${response.status}${text ? `: ${text.slice(0, 300)}` : ''}`);
}

async function main() {
  assertEnv();

  const config = getConfig();
  const key = `health-checks/spaces-test-${Date.now()}.txt`;
  const body = Buffer.from(`lokswami spaces health check ${new Date().toISOString()}\n`, 'utf8');

  console.log(`Testing bucket ${config.bucket} in ${config.region}`);
  console.log(`Test key: ${key}`);

  const putResponse = await fetch(createPresignedPutUrl(config, key), {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/plain',
      'x-amz-acl': 'public-read',
    },
    body,
  });
  await expectOk('PUT upload', putResponse);

  const headRequest = createSignedObjectRequest(config, 'HEAD', key);
  const headResponse = await fetch(headRequest.url, {
    method: 'HEAD',
    headers: headRequest.headers,
  });
  await expectOk('HEAD verify', headResponse);
  console.log(`Stored bytes: ${headResponse.headers.get('content-length') || 'unknown'}`);

  if (config.cdnBaseUrl) {
    const publicUrl = `${config.cdnBaseUrl.replace(/\/+$/g, '')}/${key}`;
    const publicResponse = await fetch(publicUrl, { method: 'GET', cache: 'no-store' });
    await expectOk('CDN public GET', publicResponse);
  }

  const deleteRequest = createSignedObjectRequest(config, 'DELETE', key);
  const deleteResponse = await fetch(deleteRequest.url, {
    method: 'DELETE',
    headers: deleteRequest.headers,
  });
  await expectOk('DELETE cleanup', deleteResponse, [204]);

  console.log('DigitalOcean Spaces connection, upload, verify, and cleanup passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
