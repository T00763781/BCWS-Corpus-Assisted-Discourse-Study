import { chromium } from 'playwright';

const url='https://www.instagram.com/p/DVrl69WAVeK/?img_index=1';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:'./secrets/instagram_storage_state.json'});
const page=await context.newPage();
await page.goto(url,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(3000);

const captured=[];
for(let i=0;i<14;i++){
  const item=await page.evaluate(()=>{
    const imgs=[...document.querySelectorAll('img')].map(img=>{
      const src=img.currentSrc||img.getAttribute('src')||'';
      const r=img.getBoundingClientRect();
      const area=Math.max(0,r.width*r.height);
      return {src,area};
    }).filter(x=>x.src && !x.src.startsWith('data:') && x.area>50000)
      .sort((a,b)=>b.area-a.area);
    return imgs[0]?.src||null;
  });
  captured.push(item);
  const moved=await page.evaluate(()=>{
    const c=[...document.querySelectorAll('button,div[role="button"],a')];
    const n=c.find(el=>((el.getAttribute('aria-label')||'').toLowerCase().includes('next')) || ((el.textContent||'').trim().toLowerCase()==='next'));
    if(!n) return false;
    n.click();
    return true;
  });
  if(!moved) break;
  await page.waitForTimeout(700);
}

const rows=captured.map((u,idx)=>{
  try{const nu=new URL(u); return {idx:idx+1,url:u,path:nu.pathname,ig:nu.searchParams.get('ig_cache_key')};}
  catch{return {idx:idx+1,url:u,path:null,ig:null};}
});
console.log(JSON.stringify(rows,null,2));
console.log('total',rows.length,'unique_full',new Set(rows.map(r=>r.url)).size,'unique_path',new Set(rows.map(r=>r.path)).size,'unique_ig',new Set(rows.map(r=>r.ig)).size);
await browser.close();