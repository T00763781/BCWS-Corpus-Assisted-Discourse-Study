import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:'./secrets/instagram_storage_state.json'});
const page=await context.newPage();
await page.goto('https://www.instagram.com/p/DVrl69WAVeK/?img_index=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(4000);
const html=await page.content();
const rx=new RegExp('https:\\\\/\\\\/instagram[^\\"\']+?82787-15[^\\"\']+?\\.jpg[^\\"\']*','g');
const raw=html.match(rx)||[];
const decoded=raw.map(s=>s.replace(/\\u002F/g,'/').replace(/\\\//g,'/').replace(/\\u0026/g,'&'));
const keys=decoded.map(u=>{try{const x=new URL(u);return x.searchParams.get('ig_cache_key')||x.pathname}catch{return null}}).filter(Boolean);
const uniq=[...new Set(keys)];
console.log('raw',raw.length,'decoded',decoded.length,'unique_keys',uniq.length);
console.log(uniq.slice(0,30));
await browser.close();