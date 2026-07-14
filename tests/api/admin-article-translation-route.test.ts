import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionFromReqMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSessionFromReq: getAdminSessionFromReqMock,
}));

describe('/api/admin/articles/assist/translate POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GEMINI_API_KEY', 'test-provider-key');
    vi.stubEnv('GEMINI_MODEL', 'test-translation-model');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does not contact the provider without an authenticated article user', async () => {
    getAdminSessionFromReqMock.mockResolvedValue(null);
    const providerFetch = vi.fn();
    vi.stubGlobal('fetch', providerFetch);
    const { POST } = await import('@/app/api/admin/articles/assist/translate/route');

    const response = await POST(new Request('http://localhost/api/admin/articles/assist/translate', {
      method: 'POST',
      body: JSON.stringify({ field: 'summary', targetLanguage: 'hi', sourceText: 'Source' }),
    }) as unknown as NextRequest);

    expect(response.status).toBe(401);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('sends only approved newsroom context and returns a review draft', async () => {
    getAdminSessionFromReqMock.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    const providerFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ translation: 'स्वीकृत अनुवाद' }) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', providerFetch);
    const { POST } = await import('@/app/api/admin/articles/assist/translate/route');

    const response = await POST(new Request('http://localhost/api/admin/articles/assist/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field: 'summary',
        targetLanguage: 'hi',
        sourceText: 'The council approved the route on Monday.',
        articleBody: '<p>The vote was 8-2.</p>',
        reporterNotes: 'Verify with the signed minutes.',
        sourcePackage: 'Council minutes, page 4.',
        unrelatedSecret: 'must-not-be-forwarded',
      }),
    }) as unknown as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual(expect.objectContaining({
      field: 'summary',
      targetLanguage: 'hi',
      sourceText: 'The council approved the route on Monday.',
      translation: 'स्वीकृत अनुवाद',
    }));
    expect(providerFetch).toHaveBeenCalledOnce();
    const [url, init] = providerFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/test-translation-model:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-provider-key');
    const providerBody = JSON.stringify(JSON.parse(String(init.body)));
    expect(providerBody).toContain('The vote was 8-2.');
    expect(providerBody).toContain('signed minutes');
    expect(providerBody).toContain('Council minutes, page 4.');
    expect(providerBody).toContain('do not add, remove, infer, or correct');
    expect(providerBody).not.toContain('must-not-be-forwarded');
  });

  it('fails closed when the provider is not configured', async () => {
    getAdminSessionFromReqMock.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    vi.stubEnv('GEMINI_API_KEY', '');
    const providerFetch = vi.fn();
    vi.stubGlobal('fetch', providerFetch);
    const { POST } = await import('@/app/api/admin/articles/assist/translate/route');

    const response = await POST(new Request('http://localhost/api/admin/articles/assist/translate', {
      method: 'POST',
      body: JSON.stringify({ field: 'content', targetLanguage: 'en', sourceText: '<p>समाचार</p>' }),
    }) as unknown as NextRequest);

    expect(response.status).toBe(503);
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
