import { chromium } from 'playwright';

const base='https://www.instagram.com/p/DVrl69WAVeK/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:'./secrets/instagram_storage_state.json'});
const page=await context.newPage();
const rows=[];
for(let i=1;i<=15;i++){
  const u=new URL(base); u.searchParams.set('img_index',String(i));
  await page.goto(u.toString(),{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(900);
  const og=await page.evaluate(()=>document.querySelector('meta[property="og:image"]')?.getAttribute('content')||null);
  rows.push({i,og});
}
const keys=rows.map(r=>{try{const u=new URL(r.og);return u.searchParams.get('ig_cache_key')||u.pathname}catch{return null}});
console.log(JSON.stringify(rows.map((r,idx)=>({i:r.i,key:keys[idx]})),null,2));
console.log('unique',new Set(keys.filter(Boolean)).size);
await browser.close();