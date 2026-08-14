import { describe, expect, it } from 'vitest';
import { evaluateArticleSeoForEditor } from '@/lib/seo/cmsSeoValidator';

describe('SEO Phase 7 - CMS Editorial SEO Guardrails & Validator', () => {
  it('evaluates a complete, high-quality article as 100% SEO score', () => {
    const report = evaluateArticleSeoForEditor({
      title: 'इंदौर में स्वच्छता सर्वेक्षण 2026 की तैयारियां तेज हुई',
      summary: 'इंदौर नगर निगम ने 2026 स्वच्छता सर्वेक्षण के लिए विशेष स्वच्छता अभियान शुरू किया है। शहर भर में निगरानी दल तैनात किए गए हैं।',
      content: 'इंदौर में स्वच्छता सर्वेक्षण 2026 को लेकर शहर के सभी वार्डों में विशेष सफाई अभियान चलाया जा रहा है। निगम आयुक्त ने अधिकारियों को आवश्यक निर्देश दिए हैं।',
      image: 'https://lokswami.com/uploads/swachh-indore.jpg',
      seo: {
        focusKeyword: 'स्वच्छता सर्वेक्षण 2026',
        metaTitle: 'इंदौर में स्वच्छता सर्वेक्षण 2026 की तैयारियां तेज',
        metaDescription: 'इंदौर नगर निगम ने स्वच्छता सर्वेक्षण 2026 के लिए विशेष अभियान शुरू किया। सभी वार्डों में सख्त निगरानी रहेगी।',
      },
    });

    expect(report.score).toBe(100);
    expect(report.isPublishReady).toBe(true);
    expect(report.errorsCount).toBe(0);
    expect(report.warningsCount).toBe(0);
  });

  it('fails publishing readiness when required title and image are missing', () => {
    const report = evaluateArticleSeoForEditor({
      title: '',
      summary: '',
      content: '',
      image: '',
    });

    expect(report.isPublishReady).toBe(false);
    expect(report.errorsCount).toBeGreaterThan(0);
    const titleCheck = report.checks.find((c) => c.key === 'title');
    expect(titleCheck?.status).toBe('fail');
  });

  it('allows breaking news to publish when critical errors are absent despite keyword warnings', () => {
    const report = evaluateArticleSeoForEditor({
      title: 'राजधानी भोपाल में भारी बारिश से जनजीवन प्रभावित',
      summary: 'भोपाल के कई इलाकों में जलभराव की स्थिति बन गई है।',
      content: 'लगातार हो रही बारिश के कारण निचले इलाकों में पानी भर गया है।',
      image: 'https://lokswami.com/uploads/bhopal-rain.jpg',
      isBreaking: true,
    });

    expect(report.isPublishReady).toBe(true);
  });

  it('detects invalid canonical overrides', () => {
    const report = evaluateArticleSeoForEditor({
      title: 'मध्य प्रदेश कैबिनेट का बड़ा फैसला',
      summary: 'कैबिनेट बैठक में कई महत्वपूर्ण प्रस्तावों को मंजूरी दी गई।',
      content: 'मुख्यमंत्री की अध्यक्षता में कैबिनेट बैठक आयोजित हुई।',
      image: 'https://lokswami.com/uploads/cabinet.jpg',
      currentSlug: 'mp-cabinet-decisions-2026',
      seo: {
        canonicalUrl: 'https://evil-external-site.com/hacked-page',
      },
    });

    const canonicalCheck = report.checks.find((c) => c.key === 'canonical');
    expect(canonicalCheck?.status).toBe('fail');
    expect(report.errorsCount).toBeGreaterThan(0);
    expect(report.isPublishReady).toBe(false);
  });
});
