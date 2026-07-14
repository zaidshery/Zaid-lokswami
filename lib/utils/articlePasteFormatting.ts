const BODY_LABEL_PATTERN = /^(body|article body|story body|content|article content)\s*:?$/i;
const BULLET_LINE_PATTERN = /^[-*\u2022]\s+/;
const NUMBERED_LINE_PATTERN = /^\d+[\.)]\s+/;
const SENTENCE_END_PATTERN = /[.!?\u0964]$/u;
const HEADING_MAX_LENGTH = 110;

type PolishedTextBlock = {
  lines: string[];
  text: string;
};

function escapeEditorHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeEditorLine(value: string) {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function buildBasicPolishedPlainTextHtml(value: string) {
  const blocks = value
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split('\n').map(normalizeEditorLine).filter(Boolean);
      if (lines.length > 1 && lines.every((line) => BULLET_LINE_PATTERN.test(line))) {
        return `<ul>${lines
          .map((line) => `<li>${escapeEditorHtml(line.replace(BULLET_LINE_PATTERN, ''))}</li>`)
          .join('')}</ul>`;
      }
      return `<p>${escapeEditorHtml(lines.join(' '))}</p>`;
    })
    .join('');
}

function getPolishedTextBlocks(value: string): PolishedTextBlock[] {
  const blocks = value
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map(normalizeEditorLine).filter(Boolean);
      return { lines, text: lines.join(' ') };
    })
    .filter((block) => block.text);

  if (blocks[0]?.lines[0] && BODY_LABEL_PATTERN.test(blocks[0].lines[0])) {
    const [, ...remainingLines] = blocks[0].lines;
    if (!remainingLines.length) return blocks.slice(1);
    return [{ lines: remainingLines, text: remainingLines.join(' ') }, ...blocks.slice(1)];
  }
  return blocks;
}

function isLikelySectionHeading(
  block: PolishedTextBlock,
  index: number,
  blocks: PolishedTextBlock[]
) {
  if (block.lines.length !== 1) return false;
  if (block.text.length < 4 || block.text.length > HEADING_MAX_LENGTH) return false;
  if (SENTENCE_END_PATTERN.test(block.text)) return false;
  if (BULLET_LINE_PATTERN.test(block.text) || NUMBERED_LINE_PATTERN.test(block.text)) return false;
  const nextBlock = blocks[index + 1];
  return Boolean(nextBlock && nextBlock.text.length >= Math.max(80, block.text.length + 30));
}

export function buildPolishedPlainTextHtml(value: string) {
  const blocks = getPolishedTextBlocks(value);
  if (!blocks.length) return buildBasicPolishedPlainTextHtml(value);

  return blocks
    .map((block, index) => {
      if (block.lines.length > 1 && block.lines.every((line) => BULLET_LINE_PATTERN.test(line))) {
        return `<ul>${block.lines
          .map((line) => `<li>${escapeEditorHtml(line.replace(BULLET_LINE_PATTERN, ''))}</li>`)
          .join('')}</ul>`;
      }
      if (block.lines.length > 1 && block.lines.every((line) => NUMBERED_LINE_PATTERN.test(line))) {
        return `<ol>${block.lines
          .map((line) => `<li>${escapeEditorHtml(line.replace(NUMBERED_LINE_PATTERN, ''))}</li>`)
          .join('')}</ol>`;
      }
      if (isLikelySectionHeading(block, index, blocks)) {
        return `<h2>${escapeEditorHtml(block.text)}</h2>`;
      }
      return `<p>${escapeEditorHtml(block.text)}</p>`;
    })
    .join('');
}

export function polishArticleEditorHtml(html: string) {
  if (typeof document === 'undefined') return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  const hasStructuredBlocks = Boolean(
    container.querySelector(
      'p,h1,h2,h3,h4,ul,ol,li,blockquote,figure,table,iframe,img,.article-resource-card'
    )
  );
  if (!hasStructuredBlocks) return buildPolishedPlainTextHtml(container.textContent || html);

  container.querySelectorAll('script,style').forEach((node) => node.remove());
  container.querySelectorAll('p,li,h2,h3,blockquote').forEach((node) => {
    node.textContent = normalizeEditorLine(node.textContent || '');
  });
  container.querySelectorAll('p,li,h2,h3,blockquote').forEach((node) => {
    if (!normalizeEditorLine(node.textContent || '')) node.remove();
  });
  return container.innerHTML.trim();
}
