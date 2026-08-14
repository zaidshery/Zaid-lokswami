#!/usr/bin/env node

/**
 * Lokswami Automated SEO & Indexing Health Audit Script
 * Usage: node scripts/seo-health-audit.js --baseUrl=https://lokswami.com
 */

const http = require('http');
const https = require('https');

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = 'https://lokswami.com';
  let timeoutMs = 20000;

  for (const arg of args) {
    if (arg.startsWith('--baseUrl=')) {
      baseUrl = arg.split('=')[1].replace(/\/+$/, '');
    } else if (arg.startsWith('--timeoutMs=')) {
      timeoutMs = parseInt(arg.split('=')[1], 10) || 20000;
    }
  }

  return { baseUrl, timeoutMs };
}

function fetchUrl(targetUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(
      targetUrl,
      {
        headers: {
          'User-Agent': 'LokswamiSeoHealthScanner/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${targetUrl}`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

async function runAudit() {
  const { baseUrl, timeoutMs } = parseArgs();
  console.log(`[SEO Audit] Scanning: ${baseUrl}`);
  const results = [];

  // 1. Robots.txt
  try {
    const robots = await fetchUrl(`${baseUrl}/robots.txt`, timeoutMs);
    const hasSitemap = robots.body.includes('sitemap.xml');
    const hasNewsSitemap = robots.body.includes('news-sitemap.xml');
    const pass = robots.statusCode === 200 && hasSitemap && hasNewsSitemap;
    results.push({
      check: 'Robots.txt & Sitemap Advertisement',
      status: pass ? 'PASS' : 'FAIL',
      detail: `Status: ${robots.statusCode}, Sitemaps: ${hasSitemap && hasNewsSitemap ? 'Advertised' : 'Missing'}`,
    });
  } catch (err) {
    results.push({ check: 'Robots.txt', status: 'FAIL', detail: err.message });
  }

  // 2. Standard Sitemap XML
  try {
    const sitemap = await fetchUrl(`${baseUrl}/sitemap.xml`, timeoutMs);
    const hasXmlHeader = sitemap.body.includes('<?xml') || sitemap.body.includes('<urlset');
    const pass = sitemap.statusCode === 200 && hasXmlHeader;
    results.push({
      check: 'Standard Sitemap XML (/sitemap.xml)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `Status: ${sitemap.statusCode}, XML Header: ${hasXmlHeader ? 'Valid' : 'Invalid'}`,
    });
  } catch (err) {
    results.push({ check: 'Standard Sitemap XML', status: 'FAIL', detail: err.message });
  }

  // 3. Google News Sitemap XML
  try {
    const newsSitemap = await fetchUrl(`${baseUrl}/news-sitemap.xml`, timeoutMs);
    const hasNewsNs = newsSitemap.body.includes('xmlns:news=');
    const pass = newsSitemap.statusCode === 200 && hasNewsNs;
    results.push({
      check: 'Google News Sitemap (/news-sitemap.xml)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `Status: ${newsSitemap.statusCode}, News Namespace: ${hasNewsNs ? 'Present' : 'Missing'}`,
    });
  } catch (err) {
    results.push({ check: 'Google News Sitemap', status: 'FAIL', detail: err.message });
  }

  // 4. Homepage Canonical Check
  try {
    const home = await fetchUrl(`${baseUrl}/main`, timeoutMs);
    const hasCanonical = home.body.includes('rel="canonical"');
    const pass = home.statusCode === 200 && hasCanonical;
    results.push({
      check: 'Homepage Canonical & SSR (/main)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `Status: ${home.statusCode}, Canonical: ${hasCanonical ? 'Declared' : 'Missing'}`,
    });
  } catch (err) {
    results.push({ check: 'Homepage Canonical', status: 'FAIL', detail: err.message });
  }

  console.log('\n===== SEO Health Audit Summary =====');
  let allPass = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : '✗';
    console.log(`${icon} [${r.status}] ${r.check}: ${r.detail}`);
    if (r.status !== 'PASS') allPass = false;
  }
  console.log('====================================\n');

  if (!allPass) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runAudit().catch((err) => {
    console.error('Fatal audit error:', err);
    process.exit(1);
  });
}

module.exports = { runAudit, parseArgs, fetchUrl };
