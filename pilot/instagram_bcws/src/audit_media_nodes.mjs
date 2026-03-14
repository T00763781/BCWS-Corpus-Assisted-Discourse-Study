import { chromium } from 'playwright';

const url = process.argv[2] || 'https://www.instagram.com/p/DRiTJUfkhtK/';
const shortcode = (url.match(/\/p\/([^/?#]+)/i) || [])[1];

function walk(obj, cb, path='root') {
  if (!obj || typeof obj !== 'object') return;
  cb(obj, path);
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walk(v, cb, `${path}[${i}]`));
  } else {
    for (const [k,v] of Object.entries(obj)) walk(v, cb, `${path}.${k}`);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: './secrets/instagram_storage_state.json' });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

const scripts = await page.$$eval('script[type="application/json"]', ns => ns.map(n => n.textContent || ''));
let found = [];
for (let i=0;i<scripts.length;i++){
  const t = scripts[i];
  if(!t || t.length < 5000 || !t.includes(shortcode)) continue;
  try {
    const j = JSON.parse(t);
    walk(j, (node,p)=>{
      if (!node || typeof node !== 'object') return;
      if (node.shortcode === shortcode) {
        found.push({script:i,path:p,keys:Object.keys(node).slice(0,40),
          hasVideoUrl: !!node.video_url,
          hasSidecar: !!node.edge_sidecar_to_children,
          hasDisplay: !!node.display_resources,
          typename: node.__typename || null,
          mediaType: node.media_type || null,
          edgeCount: node.edge_sidecar_to_children?.edges?.length || null
        });
      }
    });
  } catch {}
}
console.log(JSON.stringify(found.slice(0,20),null,2));
await browser.close();