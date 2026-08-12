import ArticleDetailClient, { type ReaderArticle } from './ArticleDetailClient';
import {
  mapPublicArticleToUiArticle,
  mapPublicArticlesToUiArticles,
} from '@/lib/content/publicArticles';
import {
  getPublicArticleBySlug,
  listRelatedPublicArticles,
} from '@/lib/server/publicArticles';
import type { Article } from '@/lib/mock/data';

type ArticleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export type ArticleDetailPageData = {
  article: ReaderArticle | null;
  relatedArticles: ReaderArticle[];
};

function projectReaderArticle(article: Article): ReaderArticle {
  const { seo, ...readerArticle } = article;
  const readerSeo: NonNullable<ReaderArticle['seo']> = {};

  if (seo?.featuredImageAlt !== undefined) {
    readerSeo.featuredImageAlt = seo.featuredImageAlt;
  }
  if (seo?.featuredImageCaption !== undefined) {
    readerSeo.featuredImageCaption = seo.featuredImageCaption;
  }
  if (seo?.imageCredit !== undefined) {
    readerSeo.featuredImageCredit = seo.imageCredit;
  }

  return Object.keys(readerSeo).length
    ? { ...readerArticle, seo: readerSeo }
    : readerArticle;
}

export async function loadArticleDetailPageData(
  token: string
): Promise<ArticleDetailPageData> {
  try {
    const result = await getPublicArticleBySlug(token);
    if (!result) {
      return { article: null, relatedArticles: [] };
    }

    const mappedArticle = mapPublicArticleToUiArticle(result.article);
    if (!mappedArticle) {
      return { article: null, relatedArticles: [] };
    }
    const article = projectReaderArticle(mappedArticle);

    try {
      const related = await listRelatedPublicArticles(result.article, {
        limit: 20,
        source: result.source,
      });
      return {
        article,
        relatedArticles: mapPublicArticlesToUiArticles(related.items).map(projectReaderArticle),
      };
    } catch {
      return { article, relatedArticles: [] };
    }
  } catch {
    return { article: null, relatedArticles: [] };
  }
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { id } = await params;
  const data = await loadArticleDetailPageData(id);

  return <ArticleDetailClient key={data.article?.id || id} {...data} />;
}
