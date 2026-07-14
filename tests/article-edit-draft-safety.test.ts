import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getOrCreateArticleDraftEditorSessionId,
  isCurrentArticleDraftEditorSession,
} from '@/lib/content/articleDraftRecovery';

describe('article draft recovery safety', () => {
  it('distinguishes the current browser tab from another editing session', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const currentSession = getOrCreateArticleDraftEditorSessionId(
      'lokswami:article-draft:edit:desk:article-1',
      storage
    );

    expect(getOrCreateArticleDraftEditorSessionId(
      'lokswami:article-draft:edit:desk:article-1',
      storage
    )).toBe(currentSession);
    expect(isCurrentArticleDraftEditorSession(currentSession, currentSession)).toBe(true);
    expect(isCurrentArticleDraftEditorSession('another-tab', currentSession)).toBe(false);
  });

  it('keeps cross-session edit recovery behind an explicit restore or discard choice', () => {
    const source = fs
      .readFileSync(
        path.join(
          process.cwd(),
          'app/(admin)/admin/articles/[id]/edit/EditArticlePageClient.tsx'
        ),
        'utf8'
      )
      .replace(/\r\n/g, '\n');

    expect(source).toContain('isCurrentArticleDraftEditorSession(');
    expect(source).toContain('setPendingDraftRecovery(recovery);');
    expect(source).toContain('setDraftReady(shouldEnableDrafts);');
    expect(source).toContain('<ArticleDraftRecoveryNotice');
    expect(source).toContain('onRestore={restorePendingDraft}');
    expect(source).toContain('onDiscard={discardPendingDraft}');
  });

  it('keeps create publishing and editing blocked until recovery is resolved', () => {
    const source = fs
      .readFileSync(
        path.join(
          process.cwd(),
          'app/(admin)/admin/articles/new/ArticleCreatePageClient.tsx'
        ),
        'utf8'
      )
      .replace(/\r\n/g, '\n');

    const submitStart = source.indexOf('const handleSubmit = async (e: React.FormEvent) => {');
    const firstSubmitRule = source.indexOf('if (sourceStory?.linkedArticleId) {', submitStart);
    const submitGuard = source.slice(submitStart, firstSubmitRule);

    expect(source).toContain(
      'const draftRecoveryBlocking = !draftReady || Boolean(pendingDraftRecovery);'
    );
    expect(source).toContain("form.toggleAttribute('inert', draftRecoveryBlocking);");
    expect(submitGuard).toContain('if (draftRecoveryBlocking) {');
    expect(submitGuard).toContain(
      'Restore or discard the browser recovery copy before creating this article.'
    );
    expect(source.match(/draftRecoveryBlocking \|\|/g)).toHaveLength(3);
  });

  it('guards workflow actions with the currently loaded server draft version', () => {
    const source = fs
      .readFileSync(
        path.join(
          process.cwd(),
          'app/(admin)/admin/articles/[id]/edit/EditArticlePageClient.tsx'
        ),
        'utf8'
      )
      .replace(/\r\n/g, '\n');

    expect(source).toContain(
      '...(serverDraftVersion > 0 ? { expectedVersion: serverDraftVersion } : {}),'
    );
    expect(source).toContain(
      "response.status === 409 && data.code === 'ARTICLE_VERSION_CONFLICT'"
    );
    expect(source).toContain('id: data.data?._id || articleId');
  });

  it('drains autosave and adopts the restored server version before editing resumes', () => {
    const source = fs
      .readFileSync(
        path.join(
          process.cwd(),
          'app/(admin)/admin/articles/[id]/edit/EditArticlePageClient.tsx'
        ),
        'utf8'
      )
      .replace(/\r\n/g, '\n');

    expect(source).toContain('!restoringRevisionId &&');
    expect(source).toContain('await pauseAndWaitForServerDraft();');
    expect(source).toContain('version?: number;\n        updatedAt?: string;');
    expect(source).toContain('version: restoredVersion,');
    expect(source).toContain('updatedAt: article.updatedAt,');
  });
});
