import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('article workflow client version guards', () => {
  it('sends and refreshes versions from the article management desk', () => {
    const source = readSource('app/(admin)/admin/articles/ArticlesManagementClient.tsx');

    expect(source).toContain('version?: number;');
    expect(source).toContain('expectedVersion: article.version || 1');
    expect(source).toContain('expectedVersion: String(article.version || 1)');
    expect(source).toContain('current.map((entry) =>');
  });

  it('chains the returned create workflow version into optional assignment', () => {
    const source = readSource(
      'app/(admin)/admin/articles/new/ArticleCreatePageClient.tsx'
    );

    expect(source).toContain('let workflowExpectedVersion = savedVersion');
    expect(source).toContain('expectedVersion: workflowExpectedVersion');
    expect(source).toContain('let workflowVersion = resolveCreatedArticleVersion(workflowPayload?.data)');
    expect(source).toContain('expectedVersion: workflowVersion');
    expect(source).toContain(
      'workflowVersion = resolveCreatedArticleVersion(assignmentPayload?.data)'
    );
  });

  it('threads article versions through shared desk workflow actions only for articles', () => {
    const actions = readSource('app/(admin)/admin/DeskWorkflowActions.tsx');
    const overview = readSource('lib/admin/articleWorkflowOverview.ts');

    expect(actions).toContain(
      "...(contentType === 'article' ? { expectedVersion: articleVersion } : {}),"
    );
    expect(actions).toContain('setArticleVersion(payload.data.version);');
    expect(overview).toContain(
      ".select('_id version title category author updatedAt publishedAt workflow reporterMeta copyEditorMeta')"
    );

    for (const page of ['assignments', 'content-queue', 'copy-desk']) {
      expect(readSource(`app/(admin)/admin/${page}/page.tsx`)).toContain(
        'version={item.version}'
      );
    }
  });
});
