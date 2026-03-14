import { chromium } from 'playwright';

function pathFromUrl(u){try{return new URL(u).pathname}catch{return null}}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:'./secrets/instagram_storage_state.json'});
const page=await context.newPage();
await page.goto('https://www.instagram.com/p/DVrl69WAVeK/?img_index=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(3000);

async function currentPath(){
  const src=await page.evaluate(()=>{
    const imgs=[...document.querySelectorAll('img')].map(img=>{
      const src=img.currentSrc||img.getAttribute('src')||'';
      const r=img.getBoundingClientRect();
      const a=Math.max(0,r.width*r.height);
      return {src,a};
    }).filter(x=>x.src && x.a>50000).sort((a,b)=>b.a-a.a);
    return imgs[0]?.src||null;
  });
  return pathFromUrl(src);
}

let states=[];
states.push(await currentPath());
for(let i=0;i<20;i++){
  const moved=await page.evaluate(()=>{
    const c=[...document.querySelectorAll('button,div[role="button"],a')];
    const n=c.find(el=>((el.getAttribute('aria-label')||'').toLowerCase().includes('next')) || ((el.textContent||'').trim().toLowerCase()==='next'));
    if(!n) return false;
    n.click();
    return true;
  });
  if(!moved){console.log('no_next_at',i); break;}
  await page.waitForTimeout(1200);
  states.push(await currentPath());
}
console.log(states);
console.log('unique',new Set(states).size,'len',states.length);
await browser.close();