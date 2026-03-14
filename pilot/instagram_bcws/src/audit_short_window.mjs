import { chromium } from 'playwright';

const shortcode='DVrl69WAVeK';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:'./secrets/instagram_storage_state.json'});
const page=await context.newPage();
await page.goto(`https://www.instagram.com/p/${shortcode}/?img_index=1`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(4000);
const html=await page.content();
const idx=html.indexOf(shortcode);
const slice=html.slice(Math.max(0,idx-5000), Math.min(html.length, idx+800000))
  .replace(/\\u002F/g,'/').replace(/\\\//g,'/').replace(/\\u0026/g,'&');
const rx=/https:\/\/[^"']+?(?:cdninstagram|fbcdn\.net)[^"']+?82787-15[^"']+?\.jpg[^"']*/g;
const urls=slice.match(rx)||[];
const uniq=[]; const seen=new Set();
for(const u of urls){
  try{const nu=new URL(u); const k=nu.searchParams.get('ig_cache_key')||nu.pathname; if(seen.has(k)) continue; seen.add(k); uniq.push({k,u});}
  catch{}
}
console.log('idx',idx,'raw',urls.length,'uniq',uniq.length);
console.log(JSON.stringify(uniq.slice(0,20).map(x=>x.k),null,2));
await browser.close();