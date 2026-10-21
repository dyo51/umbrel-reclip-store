const HEADING_RE = /^(#{2,4})\s+(.+?)\s*#*\s*$/;
const LIST_RE = /^\s*(?:[-*+]\s+|\d+\.\s+)(.+?)\s*$/;
const LINK_RE = /!?\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const IGNORED_SECTIONS = new Set(['contents', 'table of contents', 'toc']);

export function safeExternalUrl(value) {
  try {
    const url = new URL(String(value).trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function shouldRetryStatus(status) {
  return [429, 500, 502, 503, 504].includes(Number(status));
}

export function filterSections(sections, query) {
  const term = String(query).trim().toLocaleLowerCase();
  if (!term) return sections;

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const haystack = [section.category, section.title, item.text, ...item.links.map((link) => link.label)]
          .join(' ')
          .toLocaleLowerCase();
        return haystack.includes(term);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function parseLegendaryIndex(markdown) {
  const results = [];
  const seen = new Set();
  const pattern = /^\s*(?:[-*+]\s+|\d+\.\s+)\[([^\]]+)\]\(\s*\.?\/?docs\/([A-Za-z0-9._/-]+\.md)(?:#[^)]*)?\s*\)/gim;

  for (const match of String(markdown).matchAll(pattern)) {
    const file = match[2];
    if (file.split('/').some((part) => part === '..' || part === '.')) continue;
    const path = `docs/${file}`;
    if (seen.has(path)) continue;
    seen.add(path);
    results.push({ title: cleanHeading(match[1]), path });
  }
  return results;
}

export function parseSections(markdown) {
  const sections = [];
  let current = null;

  for (const line of String(markdown).split(/\r?\n/)) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      const title = cleanHeading(heading[2]);
      if (IGNORED_SECTIONS.has(title.toLowerCase())) {
        current = null;
        continue;
      }
      current = { title, level: heading[1].length, items: [] };
      sections.push(current);
      continue;
    }

    const listItem = line.match(LIST_RE);
    if (listItem) {
      if (!current) continue;
      const source = listItem[1];
      const links = [];
      for (const match of source.matchAll(LINK_RE)) {
        if (match[0].startsWith('!')) continue;
        const url = safeExternalUrl(match[2]);
        if (url) links.push({ label: plainText(match[1]), url });
      }
      current.items.push({ text: plainText(source), links });
    }
  }

  return sections.filter((section) => section.items.length > 0);
}

function cleanHeading(value) {
  return plainText(value)
    .replace(/^(?:[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u20E3\p{Emoji_Modifier}]+\s*)+/u, '')
    .trim();
}

function plainText(value) {
  return String(value)
    .replace(LINK_RE, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\\([\\`*_{}\[\]()#+.!>-])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
