import type { EPaperPublicationType } from '@/lib/types/epaper';

export type WorkflowReadinessState = 'ready' | 'needs_attention' | 'blocked';

export type WorkflowReadinessCheck = {
  id: string;
  label: string;
  status: 'complete' | 'warning' | 'blocked';
  detail: string;
};

export type WorkflowReadinessReport = {
  state: WorkflowReadinessState;
  score: number;
  blockers: string[];
  warnings: string[];
  checks: WorkflowReadinessCheck[];
};

type EditorialReadinessInput = {
  contentType: 'article' | 'story' | 'video';
  title?: unknown;
  summary?: unknown;
  content?: unknown;
  category?: unknown;
  author?: unknown;
  image?: unknown;
  slug?: unknown;
  description?: unknown;
  thumbnail?: unknown;
  videoUrl?: unknown;
  mediaUrl?: unknown;
  mediaAssets?: unknown;
  isBreaking?: unknown;
  breakingAudioReady?: unknown;
};

type PublicationReadinessInput = {
  publicationType?: EPaperPublicationType | unknown;
  title?: unknown;
  pdfPath?: unknown;
  thumbnailPath?: unknown;
  pageCount?: unknown;
  pagesMissingImage?: unknown;
  blockers?: unknown;
  warnings?: unknown;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasMediaAssets(value: unknown) {
  return Array.isArray(value) && value.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return Boolean(text((entry as { url?: unknown }).url));
  });
}

function createCheck(
  id: string,
  label: string,
  complete: boolean,
  options: { detail: string; warning?: boolean }
): WorkflowReadinessCheck {
  return {
    id,
    label,
    status: complete ? 'complete' : options.warning ? 'warning' : 'blocked',
    detail: complete ? `${label} is ready.` : options.detail,
  };
}

export function summarizeWorkflowReadiness(
  checks: WorkflowReadinessCheck[]
): WorkflowReadinessReport {
  const blockers = checks
    .filter((check) => check.status === 'blocked')
    .map((check) => check.detail);
  const warnings = checks
    .filter((check) => check.status === 'warning')
    .map((check) => check.detail);
  const complete = checks.filter((check) => check.status === 'complete').length;
  const warningWeight = checks.filter((check) => check.status === 'warning').length * 0.5;

  return {
    state: blockers.length ? 'blocked' : warnings.length ? 'needs_attention' : 'ready',
    score: Math.round(((complete + warningWeight) / Math.max(checks.length, 1)) * 100),
    blockers,
    warnings,
    checks,
  };
}

export function buildEditorialReadiness(
  input: EditorialReadinessInput
): WorkflowReadinessReport {
  const checks: WorkflowReadinessCheck[] = [
    createCheck('title', 'Headline', Boolean(text(input.title)), {
      detail: 'Add a clear headline before publishing.',
    }),
    createCheck('category', 'Category', Boolean(text(input.category)), {
      detail: 'Choose a newsroom category before publishing.',
    }),
  ];

  if (input.contentType === 'article') {
    checks.push(
      createCheck('summary', 'Summary', Boolean(text(input.summary)), {
        detail: 'Add a reader-facing summary before publishing.',
      }),
      createCheck('body', 'Story body', text(input.content).length >= 80, {
        detail: 'Complete the article body before publishing.',
      }),
      createCheck('author', 'Byline', Boolean(text(input.author)), {
        detail: 'Choose an author before publishing.',
      }),
      createCheck('image', 'Featured image', Boolean(text(input.image)), {
        detail: 'Add a featured image before publishing.',
      }),
      createCheck('slug', 'URL slug', Boolean(text(input.slug)), {
        detail: 'Add a stable URL slug before publishing.',
      })
    );

    if (Boolean(input.isBreaking)) {
      checks.push(
        createCheck('breaking-audio', 'Breaking audio', Boolean(input.breakingAudioReady), {
          detail: 'Breaking stories require matching audio before publishing.',
        })
      );
    }
  }

  if (input.contentType === 'story') {
    checks.push(
      createCheck(
        'story-media',
        'Story media',
        Boolean(text(input.thumbnail) || text(input.mediaUrl) || hasMediaAssets(input.mediaAssets)),
        { detail: 'Add at least one image or video before publishing.' }
      )
    );
  }

  if (input.contentType === 'video') {
    checks.push(
      createCheck('video-description', 'Description', Boolean(text(input.description)), {
        detail: 'Add a video description before publishing.',
      }),
      createCheck('video-thumbnail', 'Thumbnail', Boolean(text(input.thumbnail)), {
        detail: 'Add a video thumbnail before publishing.',
      }),
      createCheck('video-source', 'Video source', Boolean(text(input.videoUrl)), {
        detail: 'Add the final video source before publishing.',
      })
    );
  }

  return summarizeWorkflowReadiness(checks);
}

export function buildPublicationReadiness(
  input: PublicationReadinessInput
): WorkflowReadinessReport {
  const publicationType = input.publicationType === 'emagazine' ? 'emagazine' : 'epaper';
  const issueLabel = publicationType === 'emagazine' ? 'monthly issue' : 'edition';
  const inheritedBlockers = Array.isArray(input.blockers)
    ? input.blockers.map((item) => text(item)).filter(Boolean)
    : [];
  const inheritedWarnings = Array.isArray(input.warnings)
    ? input.warnings.map((item) => text(item)).filter(Boolean)
    : [];
  const pageCount = Number(input.pageCount || 0);
  const pagesMissingImage = Number(input.pagesMissingImage || 0);

  const checks: WorkflowReadinessCheck[] = [
    createCheck('publication-title', 'Issue title', Boolean(text(input.title)), {
      detail: `Add a title for this ${issueLabel}.`,
    }),
    createCheck('publication-pdf', 'PDF', Boolean(text(input.pdfPath)), {
      detail: `Upload the final PDF for this ${issueLabel}.`,
    }),
    createCheck('publication-pages', 'Page conversion', pageCount > 0 && pagesMissingImage === 0, {
      detail:
        pagesMissingImage > 0
          ? `${pagesMissingImage} page image${pagesMissingImage === 1 ? ' is' : 's are'} missing.`
          : `Generate page images for this ${issueLabel}.`,
    }),
    createCheck('publication-cover', 'Cover image', Boolean(text(input.thumbnailPath)), {
      detail: `Add a cover image for this ${issueLabel}.`,
    }),
  ];

  inheritedBlockers.forEach((detail, index) => {
    checks.push({
      id: `publication-blocker-${index}`,
      label: 'Production requirement',
      status: 'blocked',
      detail,
    });
  });
  inheritedWarnings.forEach((detail, index) => {
    checks.push({
      id: `publication-warning-${index}`,
      label: 'Production review',
      status: 'warning',
      detail,
    });
  });

  return summarizeWorkflowReadiness(checks);
}

export function getReadinessBlockingMessage(report: WorkflowReadinessReport) {
  if (!report.blockers.length) return null;
  return `Publishing is blocked: ${report.blockers.join(' ')}`;
}

export function validateEditorialPublishReadiness(
  input: EditorialReadinessInput,
  action: string
) {
  if (action !== 'schedule' && action !== 'publish' && action !== 'fast_publish') return null;
  return getReadinessBlockingMessage(buildEditorialReadiness(input));
}
