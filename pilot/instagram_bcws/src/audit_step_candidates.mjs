import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:'./secrets/instagram_storage_state.json'});
const page=await context.newPage();
await page.goto('https://www.instagram.com/p/DVrl69WAVeK/?img_index=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(3000);

function key(u){try{return new URL(u).pathname}catch{return u}}
async function candidates(){
  return await page.evaluate(()=>{
    return [...document.querySelectorAll('img')].map(img=>{
      const src=img.currentSrc||img.getAttribute('src')||'';
      const r=img.getBoundingClientRect();
      const a=Math.max(0,r.width*r.height);
      return {src,a,w:r.width,h:r.height,top:r.top,bottom:r.bottom};
    }).filter(x=>x.src && !x.src.startsWith('data:') && x.a>30000 && x.bottom>=0 && x.top<=window.innerHeight)
      .sort((a,b)=>b.a-a.a)
      .slice(0,8);
  });
}
async function clickNext(){
  return await page.evaluate(()=>{
    const c=[...document.querySelectorAll('button,div[role="button"],a')];
    const n=c.find(el=>((el.getAttribute('aria-label')||'').toLowerCase().includes('next')) || ((el.textContent||'').trim().toLowerCase()==='next'));
    if(!n) return false; n.click(); return true;
  });
}

const logs=[];
for(let i=0;i<12;i++){
  const c=await candidates();
  logs.push({step:i+1,top:key(c[0]?.src||''),all:c.map(x=>key(x.src))});
  const moved=await clickNext();
  if(!moved) break;
  await page.waitForTimeout(900);
}
console.log(JSON.stringify(logs,null,2));
await browser.close();