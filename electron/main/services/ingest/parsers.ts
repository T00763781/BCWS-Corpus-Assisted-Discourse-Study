function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseResponseUpdates(html: string): string[] {
  if (!html) return [];

  const blocks: string[] = [];
  const sectionRegex = /Response\s*Update[\s\S]{0,1000}?<\/h[1-6]>[\s\S]*?(<p[\s\S]*?<\/p>|<div[\s\S]*?<\/div>)/gi;
  for (const match of html.matchAll(sectionRegex)) {
    const raw = match[0] || '';
    const text = stripTags(raw).replace(/^Response\s*Update\s*/i, '').trim();
    if (text && text.length > 20) {
      blocks.push(text);
    }
  }

  const unique = [...new Set(blocks.map((value) => value.trim()).filter(Boolean))];
  return unique;
}

export const ingestParsers = {
  parseResponseUpdates,
};
