import { chromium } from 'playwright';

const url = process.argv[2] || 'https://www.instagram.com/p/DVrl69WAVeK/?img_index=1';
const shortcode = (url.match(/\/p\/([^/?#]+)/i) || [])[1];

function walk(obj, visit) {
  if (!obj || typeof obj !== 'object') return;
  visit(obj);
  if (Array.isArray(obj)) {
    for (const v of obj) walk(v, visit);
  } else {
    for (const v of Object.values(obj)) walk(v, visit);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

const scripts = await page.$$eval('script[type="application/json"]', nodes => nodes.map(n => n.textContent || ''));

for (let i = 0; i < scripts.length; i += 1) {
  const txt = scripts[i];
  if (!txt || txt.length < 1000 || !txt.includes(shortcode)) continue;
  try {
    const j = JSON.parse(txt);
    const hits = [];
    walk(j, (node) => {
      if (node && typeof node === 'object' && node.shortcode === shortcode) {
        hits.push({
          keys: Object.keys(node).slice(0, 30),
          hasCaption: !!node.caption,
          hasEdgeCaption: !!node.edge_media_to_caption,
          hasComments: !!node.edge_media_to_parent_comment || !!node.edge_media_preview_comment,
          hasSidecar: !!node.edge_sidecar_to_children,
          typename: node.__typename || null,
          taken_at_timestamp: node.taken_at_timestamp || null,
          comment_count: node.edge_media_to_parent_comment?.count || node.edge_media_to_comment?.count || null,
          sidecar_count: node.edge_sidecar_to_children?.edges?.length || null
        });
      }
    });
    if (hits.length) {
      console.log(JSON.stringify({scriptIndex:i,scriptLen:txt.length,hits:hits.slice(0,3)},null,2));
    }
  } catch {}
}

await browser.close();