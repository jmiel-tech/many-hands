// A tiny Markdown subset for assistant replies: paragraphs, headings, lists, code, bold, italic and links.
// It returns plain data (never HTML strings), and React renders it, so model output can't inject markup.

const SAFE_URL = /^(https?:|mailto:)/i;
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\s\n][^*\n]*\*|_[^_\s\n][^_\n]*_)/;

export function parseInline(text) {
  const out = [];
  let rest = text;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push({ type: 'text', text: rest });
      break;
    }
    if (m.index) out.push({ type: 'text', text: rest.slice(0, m.index) });
    const [token, code, bold, link, em] = m;
    if (code) out.push({ type: 'code', text: code.slice(1, -1) });
    else if (bold) out.push({ type: 'strong', children: parseInline(bold.slice(2, -2)) });
    else if (em) out.push({ type: 'em', children: parseInline(em.slice(1, -1)) });
    else if (link) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(link);
      if (SAFE_URL.test(href)) out.push({ type: 'link', href, children: parseInline(label) });
      else out.push({ type: 'text', text: label });
    }
    rest = rest.slice(m.index + token.length);
  }
  return out;
}

const BULLET = /^\s*[-*+•]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;

export function parseMarkdown(source = '') {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let list = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', lines: para.map(parseInline) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flushPara();
      flushList();
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      blocks.push({ type: 'pre', text: code.join('\n') });
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const number = !bullet && NUMBER.exec(line);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: 'h', children: parseInline(heading[1]) });
    } else if (bullet || number) {
      flushPara();
      const type = bullet ? 'ul' : 'ol';
      if (list?.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(parseInline((bullet || number)[1]));
    } else if (list && /^\s{2,}\S/.test(line)) {
      // An indented line continues the previous list item.
      list.items[list.items.length - 1].push({ type: 'text', text: ' ' }, ...parseInline(line.trim()));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}
