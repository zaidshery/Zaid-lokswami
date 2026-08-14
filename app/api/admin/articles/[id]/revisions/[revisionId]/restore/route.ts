import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canEditContent, canViewPage } from '@/lib/auth/permissions';
import {
  normalizeCopyEditorMeta,
  normalizeReporterMeta,
} from '@/lib/content/newsroomMetadata';
import { normalizeArticleDocument } from '@/lib/content/articleDocument';
import { normalizeArticleEditorialMeta } from '@/lib/content/articleEditorial';
import { normalizeArticleMediaMetadata } from '@/lib/content/articleMediaMetadata';
import {
  normalizeArticleSeo,
  normalizeArticleSlug,
  readArticleCanonicalEdit,
  validateEditedArticleCanonicalOverride,
} from '@/lib/seo/articleSeo';
import {
  buildArticleActivityMessage,
  recordArticleActivity,
} from '@/lib/server/articleActivity';
import {
  ArticleRevisionCanonicalValidationError,
  getStoredArticleById,
  restoreStoredArticleRevision,
} from '@/lib/storage/articlesFile';
import { resolveArticleWorkflow } from '@/lib/workflow/article';

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error(
      'MongoDB unavailable for article revision restore route, using file store.',
      error
    );
    return true;
  }
}

function normalizeSeo(input: unknown) {
  return normalizeArticleSeo(input);
}

function buildRevisionSnapshot(article: Record<string, unknown>) {
  const content = typeof article.content === 'string' ? article.content : '';
  return {
    title: typeof article.title === 'string' ? article.title : '',
    summary: typeof article.summary === 'string' ? article.summary : '',
    content,
    contentJson: normalizeArticleDocument(article.contentJson, content),
    image: typeof article.image === 'string' ? article.image : '',
    category: typeof article.category === 'string' ? article.category : '',
    author: typeof article.author === 'string' ? article.author : '',
    slug: normalizeArticleSlug(String(article.slug || '')),
    previousSlugs: Array.isArray(article.previousSlugs)
      ? article.previousSlugs
          .map((item) => normalizeArticleSlug(String(item || '')))
          .filter(Boolean)
      : [],
    isBreaking: Boolean(article.isBreaking),
    isTrending: Boolean(article.isTrending),
    seo: normalizeSeo(article.seo),
    reporterMeta: normalizeReporterMeta(article.reporterMeta),
    copyEditorMeta: normalizeCopyEditorMeta(article.copyEditorMeta),
    editorial: normalizeArticleEditorialMeta(article.editorial),
    media: normalizeArticleMediaMetadata(article.media),
    savedAt: new Date(),
  };
}

function normalizeSlugHistory(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizeArticleSlug(String(item || '')))
    .filter(Boolean);
}

type RouteContext = {
  params: Promise<{ id: string; revisionId: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!canViewPage(user.role, 'article_edit')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id, revisionId } = await context.params;

    if (await shouldUseFileStore()) {
      const currentArticle = await getStoredArticleById(id);
      if (!currentArticle) {
        return NextResponse.json(
          { success: false, error: 'Article or revision not found' },
          { status: 404 }
        );
      }
      if (
        !canEditContent(user, {
          legacyAuthorName: currentArticle.author,
          workflow: resolveArticleWorkflow(currentArticle),
        })
      ) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }

      const restored = await restoreStoredArticleRevision(id, revisionId);
      if (!restored) {
        return NextResponse.json(
          { success: false, error: 'Article or revision not found' },
          { status: 404 }
        );
      }

      await recordArticleActivity({
        articleId: id,
        actor: user,
        action: 'restore_revision',
        toStatus: resolveArticleWorkflow(restored).status,
        message: buildArticleActivityMessage({ action: 'restore_revision' }),
        metadata: {
          revisionId,
        },
      });

      return NextResponse.json({
        success: true,
        data: restored,
        message: 'Revision restored successfully',
      });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid article ID' },
        { status: 400 }
      );
    }

    const article = (await Article.findById(id).lean()) as
      | (Record<string, unknown> & {
          workflow?: unknown;
          updatedAt?: Date | string;
          publishedAt?: Date | string;
          revisions?: Array<Record<string, unknown> & { _id?: unknown }>;
        })
      | null;
    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }
    if (
      !canEditContent(user, {
        legacyAuthorName: typeof article.author === 'string' ? article.author : '',
        workflow: resolveArticleWorkflow(article),
      })
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const revisions = Array.isArray(article.revisions) ? article.revisions : [];
    const targetRevision = revisions.find(
      (revision: Record<string, unknown> & { _id?: unknown }) =>
        String(revision._id || '') === revisionId
    ) as Record<string, unknown> | undefined;

    if (!targetRevision) {
      return NextResponse.json(
        { success: false, error: 'Revision not found' },
        { status: 404 }
      );
    }

    const snapshot = buildRevisionSnapshot(article as unknown as Record<string, unknown>);
    const restoredContent =
      typeof targetRevision.content === 'string' ? targetRevision.content : '';
    const currentSlug = normalizeArticleSlug(String(article.slug || ''));
    const revisionSlug = normalizeArticleSlug(String(targetRevision.slug || ''));
    const currentPreviousSlugs = normalizeSlugHistory(article.previousSlugs);
    let restoredSlug = currentSlug;
    let restoredPreviousSlugs = currentPreviousSlugs;

    if (revisionSlug) {
      const slugConflict =
        revisionSlug !== currentSlug &&
        Boolean(
          await Article.exists({
            _id: { $ne: id },
            $or: [{ slug: revisionSlug }, { previousSlugs: revisionSlug }],
          })
        );
      if (!slugConflict) {
        restoredSlug = revisionSlug;
        const slugHistory = new Set([
          ...currentPreviousSlugs,
          ...normalizeSlugHistory(targetRevision.previousSlugs),
        ]);
        if (currentSlug && currentSlug !== restoredSlug) slugHistory.add(currentSlug);
        slugHistory.delete(restoredSlug);
        restoredPreviousSlugs = Array.from(slugHistory);
      }
    }

    const canonicalEdit = readArticleCanonicalEdit(targetRevision.seo);
    const currentCanonicalUrl = normalizeSeo(article.seo).canonicalUrl;
    const canonicalError = validateEditedArticleCanonicalOverride(
      canonicalEdit,
      currentCanonicalUrl,
      { id, slug: restoredSlug }
    );
    if (canonicalError) {
      return NextResponse.json({ success: false, error: canonicalError }, { status: 400 });
    }
    const restoredSeo = normalizeSeo(targetRevision.seo);
    if (canonicalEdit.kind === 'omitted') {
      restoredSeo.canonicalUrl = currentCanonicalUrl;
    }

    const hasStoredVersion =
      typeof article.version === 'number' &&
      Number.isInteger(article.version) &&
      article.version > 0;
    const restoredArticle = await Article.findOneAndUpdate(
      {
        _id: id,
        version: hasStoredVersion ? article.version : { $exists: false },
      },
      {
        $set: {
          title: typeof targetRevision.title === 'string' ? targetRevision.title : '',
          summary: typeof targetRevision.summary === 'string' ? targetRevision.summary : '',
          content: restoredContent,
          contentJson: normalizeArticleDocument(targetRevision.contentJson, restoredContent),
          image: typeof targetRevision.image === 'string' ? targetRevision.image : '',
          category:
            typeof targetRevision.category === 'string' ? targetRevision.category : '',
          author: typeof targetRevision.author === 'string' ? targetRevision.author : '',
          slug: restoredSlug,
          previousSlugs: restoredPreviousSlugs,
          isBreaking: Boolean(targetRevision.isBreaking),
          isTrending: Boolean(targetRevision.isTrending),
          seo: restoredSeo,
          reporterMeta: normalizeReporterMeta(targetRevision.reporterMeta),
          copyEditorMeta: normalizeCopyEditorMeta(targetRevision.copyEditorMeta),
          editorial: normalizeArticleEditorialMeta(targetRevision.editorial),
          media: normalizeArticleMediaMetadata(targetRevision.media),
          updatedAt: new Date(),
        },
        // Mongo starts a missing field at zero for $inc. Legacy articles have a
        // logical version of 1, so initialize them to 2 while preserving one
        // atomic compare-and-swap update.
        $inc: { version: hasStoredVersion ? 1 : 2 },
        $push: { revisions: { $each: [snapshot], $slice: -30 } },
      },
      { new: true, runValidators: true }
    );

    if (!restoredArticle) {
      return NextResponse.json(
        {
          success: false,
          error: 'This article was updated in another session.',
        },
        { status: 409 }
      );
    }

    await recordArticleActivity({
      articleId: id,
      actor: user,
      action: 'restore_revision',
      toStatus: resolveArticleWorkflow(restoredArticle.toObject()).status,
      message: buildArticleActivityMessage({ action: 'restore_revision' }),
      metadata: {
        revisionId,
        revisionTitle:
          typeof targetRevision.title === 'string' ? targetRevision.title : '',
      },
    });

    return NextResponse.json({
      success: true,
      data: restoredArticle,
      message: 'Revision restored successfully',
    });
  } catch (error) {
    if (error instanceof ArticleRevisionCanonicalValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    console.error('Error restoring article revision:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to restore revision' },
      { status: 500 }
    );
  }
}
