'use client';

import {
  BarChart3,
  Cookie,
  Globe2,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import LegalPageLayout, {
  type LegalPageHighlight,
  type LegalPageSection,
} from '@/components/ui/LegalPageLayout';
import { useAppStore } from '@/lib/store/appStore';

const EFFECTIVE_DATE = 'September 9, 2026';

const COPY = {
  en: {
    heroTag: 'Cookie Policy',
    title: 'Cookie Policy for Lokswami.com',
    subtitle:
      'This Cookie Policy explains how Lokswami.com, operated by Lokswami Newspaper, uses cookies and similar tracking technologies on the website and related digital services.',
    legalNote:
      'Cookies help the website remain secure, remember preferences, improve functionality, analyse usage patterns, and support relevant content delivery.',
    consentNote:
      'Strictly necessary storage is used to operate the Website. Optional Google Analytics storage is enabled only when you select “Allow analytics” in the consent banner.',
    highlightsTitle: 'Cookie Categories',
    highlights: [
      { label: 'Strictly Necessary', icon: ShieldCheck },
      { label: 'Analytics', icon: BarChart3 },
      { label: 'Functionality', icon: Settings2 },
      { label: 'Advertising', icon: Target },
    ] satisfies LegalPageHighlight[],
    sections: [
      {
        title: '1. Introduction',
        icon: Cookie,
        body: [
          'This Cookie Policy explains how Lokswami.com, operated by Lokswami Newspaper, uses cookies and similar tracking technologies on the Website.',
          'Optional analytics storage is not enabled merely because you access or continue using the Website.',
        ],
      },
      {
        title: '2. What Are Cookies',
        icon: Cookie,
        body: [
          'Cookies are small text files stored on your device when you visit a website. They allow the Website to remember user preferences, improve functionality, analyse usage patterns, and deliver relevant content.',
        ],
      },
      {
        title: '3. Types of Cookies Used',
        icon: ShieldCheck,
        body: ['Lokswami.com may use the following types of cookies on the Website:'],
        bullets: [
          'Strictly necessary cookies for Website operation, security, and session management',
          'Performance and analytics cookies to understand how visitors interact with the Website and to improve usability',
          'Functionality cookies to remember language choices, display settings, and other preferences',
          'Targeting or advertising cookies to support relevant advertising and measure campaign effectiveness, where applicable',
        ],
      },
      {
        title: '4. Purposes of Cookies',
        icon: BarChart3,
        body: ['Cookies may be used for the following purposes:'],
        bullets: [
          'To ensure the Website functions securely and efficiently',
          'To analyse traffic and improve user experience',
          'To remember user preferences',
          'To support relevant content delivery and advertising in compliance with applicable Indian laws',
        ],
      },
      {
        title: '5. Consent',
        icon: ShieldCheck,
        body: [
          'On your first visit, a consent banner lets you allow or reject optional Google Analytics.',
          'You may change or withdraw that choice at any time by selecting the Cookie settings control on the Website.',
        ],
      },
      {
        title: '6. Managing Cookies',
        icon: Settings2,
        body: [
          'Users may control or delete cookies through browser settings. Disabling cookies may affect certain features, functionality, and overall Website experience.',
        ],
      },
      {
        title: '7. Third-Party Cookies',
        icon: Globe2,
        body: [
          'Third-party services such as analytics tools, advertising services, or embedded media may place cookies on the Website. Their use of cookies is governed by their own privacy and cookie policies.',
        ],
      },
      {
        title: '8. Changes to This Policy',
        icon: SlidersHorizontal,
        body: [
          'Lokswami reserves the right to update this Cookie Policy from time to time. Continued use of the Website after changes are posted constitutes acceptance of the updated Policy.',
        ],
      },
    ] satisfies LegalPageSection[],
    contactTitle: 'Contact Us',
    contactText:
      'If you have any questions about this Cookie Policy or about cookies used on Lokswami.com, please contact us using the details below.',
    contactRoleLabel: 'Policy Owner',
    contactRoleValue: 'Lokswami Newspaper',
    emailLabel: 'Email',
    addressLabel: 'Address',
    lastUpdatedLabel: 'Effective date',
  },
  hi: {
    heroTag: 'कुकी नीति',
    title: 'Lokswami.com की कुकी नीति',
    subtitle:
      'यह कुकी नीति बताती है कि Lokswami Newspaper द्वारा संचालित Lokswami.com वेबसाइट और संबंधित डिजिटल सेवाओं पर कुकीज़ तथा समान ट्रैकिंग तकनीकों का उपयोग कैसे किया जाता है।',
    legalNote:
      'कुकीज़ वेबसाइट को सुरक्षित रखने, उपयोगकर्ता की पसंद याद रखने, कार्यक्षमता सुधारने, उपयोग पैटर्न समझने और प्रासंगिक सामग्री उपलब्ध कराने में मदद करती हैं।',
    consentNote:
      'वेबसाइट चलाने के लिए आवश्यक स्टोरेज का उपयोग होता है। वैकल्पिक Google Analytics स्टोरेज केवल तभी चालू होता है जब आप सहमति बैनर में “एनालिटिक्स की अनुमति दें” चुनते हैं।',
    highlightsTitle: 'कुकी श्रेणियां',
    highlights: [
      { label: 'आवश्यक कुकीज़', icon: ShieldCheck },
      { label: 'एनालिटिक्स', icon: BarChart3 },
      { label: 'फंक्शनैलिटी', icon: Settings2 },
      { label: 'विज्ञापन', icon: Target },
    ] satisfies LegalPageHighlight[],
    sections: [
      {
        title: '1. परिचय',
        icon: Cookie,
        body: [
          'यह कुकी नीति बताती है कि Lokswami Newspaper द्वारा संचालित Lokswami.com वेबसाइट पर कुकीज़ और समान ट्रैकिंग तकनीकों का उपयोग कैसे किया जाता है।',
          'केवल वेबसाइट खोलने या उसका उपयोग जारी रखने से वैकल्पिक एनालिटिक्स स्टोरेज चालू नहीं होता है।',
        ],
      },
      {
        title: '2. कुकीज़ क्या हैं',
        icon: Cookie,
        body: [
          'कुकीज़ छोटे टेक्स्ट फ़ाइल होते हैं जो किसी वेबसाइट पर जाने पर आपके डिवाइस में सेव हो जाते हैं। इनके माध्यम से वेबसाइट आपकी पसंद, कार्यक्षमता, उपयोग पैटर्न और प्रासंगिक सामग्री से संबंधित जानकारी याद रख सकती है।',
        ],
      },
      {
        title: '3. उपयोग की जाने वाली कुकीज़ के प्रकार',
        icon: ShieldCheck,
        body: ['Lokswami.com वेबसाइट पर निम्न प्रकार की कुकीज़ का उपयोग कर सकता है:'],
        bullets: [
          'वेबसाइट संचालन, सुरक्षा और सेशन प्रबंधन के लिए आवश्यक कुकीज़',
          'उपयोगकर्ता व्यवहार और वेबसाइट प्रदर्शन समझने के लिए परफॉर्मेंस और एनालिटिक्स कुकीज़',
          'भाषा, डिस्प्ले सेटिंग और अन्य पसंद याद रखने के लिए फंक्शनैलिटी कुकीज़',
          'जहां लागू हो, प्रासंगिक विज्ञापन और अभियान प्रभाव मापने के लिए टार्गेटिंग या विज्ञापन कुकीज़',
        ],
      },
      {
        title: '4. कुकीज़ के उपयोग के उद्देश्य',
        icon: BarChart3,
        body: ['कुकीज़ का उपयोग निम्न उद्देश्यों के लिए किया जा सकता है:'],
        bullets: [
          'वेबसाइट को सुरक्षित और प्रभावी रूप से संचालित करने के लिए',
          'ट्रैफिक समझने और उपयोगकर्ता अनुभव बेहतर करने के लिए',
          'उपयोगकर्ता की पसंद याद रखने के लिए',
          'लागू भारतीय कानूनों के अनुरूप प्रासंगिक सामग्री और विज्ञापन उपलब्ध कराने के लिए',
        ],
      },
      {
        title: '5. सहमति',
        icon: ShieldCheck,
        body: [
          'पहली विज़िट पर सहमति बैनर से आप वैकल्पिक Google Analytics को स्वीकार या अस्वीकार कर सकते हैं।',
          'वेबसाइट पर उपलब्ध कुकी सेटिंग नियंत्रण से आप किसी भी समय अपनी पसंद बदल सकते हैं या सहमति वापस ले सकते हैं।',
        ],
      },
      {
        title: '6. कुकीज़ का प्रबंधन',
        icon: Settings2,
        body: [
          'उपयोगकर्ता अपने ब्राउज़र की सेटिंग्स के माध्यम से कुकीज़ को नियंत्रित या हटाने का विकल्प चुन सकते हैं। कुकीज़ बंद करने से वेबसाइट की कुछ सुविधाएं प्रभावित हो सकती हैं।',
        ],
      },
      {
        title: '7. थर्ड-पार्टी कुकीज़',
        icon: Globe2,
        body: [
          'एनालिटिक्स टूल, विज्ञापन सेवाएं या एम्बेडेड मीडिया जैसी थर्ड-पार्टी सेवाएं अपनी कुकीज़ सेट कर सकती हैं। ऐसे मामलों में कुकी उपयोग उनकी अपनी नीतियों के अनुसार नियंत्रित होता है।',
        ],
      },
      {
        title: '8. नीति में बदलाव',
        icon: SlidersHorizontal,
        body: [
          'Lokswami समय-समय पर इस कुकी नीति को अपडेट कर सकता है। वेबसाइट का उपयोग जारी रखना अद्यतन नीति की स्वीकृति माना जाएगा।',
        ],
      },
    ] satisfies LegalPageSection[],
    contactTitle: 'संपर्क करें',
    contactText:
      'यदि आपको इस कुकी नीति या Lokswami.com पर उपयोग की जाने वाली कुकीज़ के बारे में कोई प्रश्न हो, तो नीचे दिए गए विवरणों के माध्यम से हमसे संपर्क करें।',
    contactRoleLabel: 'नीति स्वामी',
    contactRoleValue: 'Lokswami Newspaper',
    emailLabel: 'ईमेल',
    addressLabel: 'पता',
    lastUpdatedLabel: 'प्रभावी तिथि',
  },
} as const;

export default function CookiePolicyPage() {
  const { language } = useAppStore();
  const t = COPY[language];

  return (
    <LegalPageLayout
      heroTag={t.heroTag}
      title={t.title}
      subtitle={t.subtitle}
      legalNote={t.legalNote}
      consentNote={t.consentNote}
      lastUpdatedLabel={t.lastUpdatedLabel}
      lastUpdated={EFFECTIVE_DATE}
      highlightsTitle={t.highlightsTitle}
      highlights={t.highlights}
      sections={t.sections}
      contactTitle={t.contactTitle}
      contactText={t.contactText}
      contactRoleLabel={t.contactRoleLabel}
      contactRoleValue={t.contactRoleValue}
      emailLabel={t.emailLabel}
      addressLabel={t.addressLabel}
    />
  );
}
