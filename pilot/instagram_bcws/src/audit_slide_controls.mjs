import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:'./secrets/instagram_storage_state.json'});
const page=await context.newPage();
await page.goto('https://www.instagram.com/p/DVrl69WAVeK/?img_index=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(3500);
const out=await page.evaluate(()=>{
  const nodes=[...document.querySelectorAll('[aria-label],button,a,div[role="button"],span[role="button"]')];
  return nodes.map(n=>({tag:n.tagName,role:n.getAttribute('role')||'',aria:n.getAttribute('aria-label')||'',text:(n.textContent||'').trim().slice(0,60)}))
    .filter(x=>/slide|next|previous|\d+\s*of\s*\d+|\d+\s*\/\s*\d+/i.test(`${x.aria} ${x.text}`));
});
console.log(JSON.stringify(out,null,2));
await browser.close();