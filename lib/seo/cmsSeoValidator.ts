import {
  type ArticleSeoFields,
  normalizeArticleSeo,
  validateArticleCanonicalOverride,
} from './articleSeo';

export type CmsSeoValidationStatus = 'pass' | 'warn' | 'fail';

export type CmsSeoCheckResult = {
  key: string;
  label: string;
  status: CmsSeoValidationStatus;
  message: string;
};

export type CmsSeoReport = {
  score: number;
  checks: CmsSeoCheckResult[];
  isPublishReady: boolean;
  warningsCount: number;
  errorsCount: number;
};

export function evaluateArticleSeoForEditor(input: {
  title: string;
  summary: string;
  content: string;
  image?: string;
  seo?: Partial<ArticleSeoFields>;
  currentSlug?: string;
  isBreaking?: boolean;
}): CmsSeoReport {
  const seo = normalizeArticleSeo(input.seo);
  const checks: CmsSeoCheckResult[] = [];

  // 1. Meta / Article Title Check
  const effectiveTitle = (seo.metaTitle || input.title || '').trim();
  if (!effectiveTitle) {
    checks.push({
      key: 'title',
      label: 'शीर्षक / Meta Title',
      status: 'fail',
      message: 'लेख का शीर्षक अनिवार्य है।',
    });
  } else if (effectiveTitle.length < 25) {
    checks.push({
      key: 'title',
      label: 'शीर्षक / Meta Title',
      status: 'warn',
      message: 'शीर्षक बहुत छोटा है (कम से कम 30-60 अक्षर अनुशंसित हैं)।',
    });
  } else if (effectiveTitle.length > 80) {
    checks.push({
      key: 'title',
      label: 'शीर्षक / Meta Title',
      status: 'warn',
      message: 'शीर्षक 80 अक्षरों से अधिक है (Google सर्च में कट सकता है)।',
    });
  } else {
    checks.push({
      key: 'title',
      label: 'शीर्षक / Meta Title',
      status: 'pass',
      message: 'शीर्षक की लंबाई आदर्श है।',
    });
  }

  // 2. Meta Description / Summary Check
  const effectiveDesc = (seo.metaDescription || input.summary || '').trim();
  if (!effectiveDesc) {
    checks.push({
      key: 'description',
      label: 'विवरण / Meta Description',
      status: 'warn',
      message: 'सर्च इंजनों के लिए मेटा विवरण जोड़ें (120-160 अक्षर)।',
    });
  } else if (effectiveDesc.length < 50) {
    checks.push({
      key: 'description',
      label: 'विवरण / Meta Description',
      status: 'warn',
      message: 'विवरण थोड़ा छोटा है (120-160 अक्षर अनुशंसित हैं)।',
    });
  } else {
    checks.push({
      key: 'description',
      label: 'विवरण / Meta Description',
      status: 'pass',
      message: 'मेटा विवरण सर्च अनुकूलित है।',
    });
  }

  // 3. Focus Keyword Density Check
  const keyword = (seo.focusKeyword || '').trim().toLowerCase();
  if (!keyword) {
    checks.push({
      key: 'focusKeyword',
      label: 'फोकस कीवर्ड / Focus Keyword',
      status: 'warn',
      message: 'मुख्य कीवर्ड निर्दिष्ट करने से सर्च रैंकिंग में सुधार होता है।',
    });
  } else {
    const inTitle = effectiveTitle.toLowerCase().includes(keyword);
    const inBody = (input.content || '').toLowerCase().includes(keyword);

    if (inTitle && inBody) {
      checks.push({
        key: 'focusKeyword',
        label: 'फोकस कीवर्ड / Focus Keyword',
        status: 'pass',
        message: 'फोकस कीवर्ड शीर्षक और लेख में मौजूद है।',
      });
    } else if (inTitle || inBody) {
      checks.push({
        key: 'focusKeyword',
        label: 'फोकस कीवर्ड / Focus Keyword',
        status: 'warn',
        message: 'कीवर्ड शीर्षक या मुख्य भाग में से किसी एक में छूट गया है।',
      });
    } else {
      checks.push({
        key: 'focusKeyword',
        label: 'फोकस कीवर्ड / Focus Keyword',
        status: 'fail',
        message: 'फोकस कीवर्ड न तो शीर्षक में है और न ही लेख में।',
      });
    }
  }

  // 4. Featured / OG Image Check
  const effectiveImage = (seo.ogImage || input.image || '').trim();
  if (!effectiveImage) {
    checks.push({
      key: 'image',
      label: 'फीचर्ड इमेज / Social Preview',
      status: 'fail',
      message: 'सर्च और सोशल शेयरिंग के लिए मुख्य फोटो अनिवार्य है।',
    });
  } else {
    checks.push({
      key: 'image',
      label: 'फीचर्ड इमेज / Social Preview',
      status: 'pass',
      message: 'मुख्य फोटो संलग्न है।',
    });
  }

  // 5. Canonical URL Safety Check
  if (seo.canonicalUrl) {
    const canonicalError = validateArticleCanonicalOverride(
      seo.canonicalUrl,
      { id: 'article', slug: input.currentSlug }
    );

    if (!canonicalError) {
      checks.push({
        key: 'canonical',
        label: 'कैनोनिकल यूआरएल / Canonical URL',
        status: 'pass',
        message: 'कैनोनिकल यूआरएल वैध और सुरक्षित है।',
      });
    } else {
      checks.push({
        key: 'canonical',
        label: 'कैनोनिकल यूआरएल / Canonical URL',
        status: 'fail',
        message: `अवैध कैनोनिकल: ${canonicalError}`,
      });
    }
  }

  // Calculate overall health score
  const passCount = checks.filter((c) => c.status === 'pass').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;

  const score = Math.round(
    Math.max(0, (passCount * 1.0 + warnCount * 0.5) / checks.length) * 100
  );

  // Breaking news exception: breaking stories can bypass non-fatal warnings
  const isPublishReady = input.isBreaking ? failCount === 0 : failCount === 0 && score >= 50;

  return {
    score,
    checks,
    isPublishReady,
    warningsCount: warnCount,
    errorsCount: failCount,
  };
}
