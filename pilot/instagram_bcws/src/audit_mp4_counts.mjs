import { chromium } from 'playwright';
const urls=[
'https://www.instagram.com/p/DVrl69WAVeK/?img_index=1',
'https://www.instagram.com/p/DRiTJUfkhtK/',
'https://www.instagram.com/p/DQp23MFkkIb/'
];
const rx = new RegExp(`https:\\\\/\\\\/[^\\"']+\\.mp4[^\\"']*`,'g');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:'./secrets/instagram_storage_state.json'});
for(const u of urls){
  const p=await context.newPage();
  await p.goto(u,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(4000);
  const html=await p.content();
  const matches=(html.match(rx)||[]).slice(0,20);
  console.log('\nURL',u,'mp4_matches',matches.length);
  if(matches[0]) console.log('sample',matches[0].slice(0,180));
  await p.close();
}
await browser.close();