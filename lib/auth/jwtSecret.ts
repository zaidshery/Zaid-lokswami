function normalizeSecret(value: string | undefined) {
  const trimmed = (value || '').trim();
  return trimmed || '';
}

export function getJwtSecretOrNull() {
  const candidates = [
    process.env.JWT_SECRET,
    process.env.NEXTAUTH_SECRET,
    process.env.AUTH_SECRET,
  ];

  for (const candidate of candidates) {
    const secret = normalizeSecret(candidate);
    if (secret) {
      return secret;
    }
  }

  return null;
}

export function requireJwtSecret() {
  const secret = getJwtSecretOrNull();
  if (!secret) {
    throw new Error('JWT_SECRET, NEXTAUTH_SECRET, or AUTH_SECRET must be set.');
  }
  return secret;
}
