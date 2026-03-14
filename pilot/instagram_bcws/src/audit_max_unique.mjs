import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:'./secrets/instagram_storage_state.json'});
const page=await context.newPage();
await page.goto('https://www.instagram.com/p/DVrl69WAVeK/?img_index=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(3000);

async function top(){
  return await page.evaluate(()=>{
    const imgs=[...document.querySelectorAll('img')].map(img=>{
      const src=img.currentSrc||img.getAttribute('src')||'';
      const r=img.getBoundingClientRect();
      const a=Math.max(0,r.width*r.height);
      return {src,a};
    }).filter(x=>x.src && !x.src.startsWith('data:') && x.a>50000 && /82787-15/.test(x.src)).sort((a,b)=>b.a-a.a);
    return imgs[0]?.src||null;
  });
}
function key(u){try{const n=new URL(u);return n.pathname}catch{return u}}
async function clickNext(){
  return await page.evaluate(()=>{
    const c=[...document.querySelectorAll('button,div[role="button"],a')];
    const n=c.find(el=>((el.getAttribute('aria-label')||'').toLowerCase().includes('next')) || ((el.textContent||'').trim().toLowerCase()==='next'));
    if(!n) return false; n.click(); return true;
  });
}
const arr=[];
let cur=await top(); arr.push(cur);
for(let i=0;i<20;i++){
  let advanced=false;
  for(let j=0;j<4;j++){
    const moved=await clickNext();
    if(!moved){advanced=false;break;}
    await page.waitForTimeout(700);
    const nxt=await top();
    if(key(nxt)!==key(cur)){cur=nxt; arr.push(cur); advanced=true; break;}
  }
  if(!advanced) break;
}
console.log(arr.map(key));
console.log('count',arr.length,'unique',new Set(arr.map(key)).size);
await browser.close();