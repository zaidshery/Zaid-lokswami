import { Image } from '@tiptap/extension-image';
import { Node, mergeAttributes } from '@tiptap/react';

function numericFocal(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 50;
}

export const ArticleImage = Image.extend({
  name: 'articleImage',
  inline: false,
  group: 'block',
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      caption: { default: '' },
      credit: { default: '' },
      sourceUrl: { default: '' },
      focalX: { default: 50 },
      focalY: { default: 50 },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure.article-inline-figure',
        getAttrs: (node) => {
          const figure = node as HTMLElement;
          const image = figure.querySelector('img');
          if (!image) return false;
          const captionNode = figure.querySelector('figcaption');
          const sourceNode = captionNode?.querySelector('.article-image-source');
          const captionClone = captionNode?.cloneNode(true) as HTMLElement | undefined;
          captionClone?.querySelector('.article-image-source')?.remove();
          return {
            src: image.getAttribute('src') || '',
            alt: image.getAttribute('alt') || '',
            title: image.getAttribute('title') || '',
            caption: captionClone?.textContent?.trim() || '',
            credit: sourceNode?.textContent?.replace(/^Source:\s*/i, '').trim() || '',
            sourceUrl: sourceNode?.querySelector('a')?.getAttribute('href') || '',
            focalX: numericFocal(figure.dataset.focalX),
            focalY: numericFocal(figure.dataset.focalY),
          };
        },
      },
      {
        tag: 'img[src]',
        getAttrs: (node) => {
          const image = node as HTMLImageElement;
          return {
            src: image.getAttribute('src') || '',
            alt: image.getAttribute('alt') || '',
            title: image.getAttribute('title') || '',
            caption: '',
            credit: '',
            sourceUrl: '',
            focalX: 50,
            focalY: 50,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const {
      caption = '',
      credit = '',
      sourceUrl = '',
      focalX = 50,
      focalY = 50,
      ...imageAttributes
    } = HTMLAttributes;
    const safeFocalX = numericFocal(focalX);
    const safeFocalY = numericFocal(focalY);
    const captionChildren: unknown[] = [];
    if (String(caption).trim()) captionChildren.push(String(caption).trim());
    if (String(credit).trim()) {
      if (captionChildren.length) captionChildren.push(' ');
      captionChildren.push([
        'span',
        { class: 'article-image-source' },
        'Source: ',
        String(sourceUrl).trim()
          ? [
              'a',
              {
                href: String(sourceUrl).trim(),
                target: '_blank',
                rel: 'noopener noreferrer',
              },
              String(credit).trim(),
            ]
          : String(credit).trim(),
      ]);
    }

    const figure: unknown[] = [
      'figure',
      {
        class: 'article-inline-figure',
        'data-focal-x': String(safeFocalX),
        'data-focal-y': String(safeFocalY),
        draggable: 'true',
      },
      [
        'img',
        mergeAttributes(imageAttributes, {
          loading: 'lazy',
          style: `object-position: ${safeFocalX}% ${safeFocalY}%`,
        }),
      ],
    ];
    if (captionChildren.length) figure.push(['figcaption', {}, ...captionChildren]);
    return figure as never;
  },
});

export const ArticleResourceCard = Node.create({
  name: 'articleResourceCard',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      title: { default: 'Source / Reference' },
      url: { default: '' },
      description: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'aside.article-resource-card',
        getAttrs: (node) => {
          const card = node as HTMLElement;
          return {
            title:
              card.querySelector('.article-resource-card-title')?.textContent?.trim() ||
              'Source / Reference',
            url: card.querySelector('a')?.getAttribute('href') || '',
            description:
              card.querySelector('.article-resource-card-description')?.textContent?.trim() || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const title = String(HTMLAttributes.title || 'Source / Reference');
    const url = String(HTMLAttributes.url || '').trim();
    const description = String(HTMLAttributes.description || '').trim();
    const card: unknown[] = [
      'aside',
      { class: 'article-resource-card', draggable: 'true' },
      ['p', { class: 'article-resource-card-title' }, title],
      [
        'p',
        {},
        url
          ? ['a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, url]
          : ['span', {}, 'Add your source link or supporting note here.'],
      ],
    ];
    if (description) {
      card.push(['p', { class: 'article-resource-card-description' }, description]);
    }
    return card as never;
  },
});
