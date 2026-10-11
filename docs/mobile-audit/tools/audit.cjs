const {chromium}=require('playwright');const fs=require('fs');
const stage=process.argv[2]||'before', base=stage==='before'?'http://127.0.0.1:4174':'http://127.0.0.1:4175';
const out=require('path').resolve(__dirname,'..')+'/'+stage;fs.mkdirSync(out,{recursive:true});
const sizes=[[280,653],[320,568],[360,640],[375,667],[390,844],[430,932],[412,915],[844,390],[884,720]];
const profile={name:'Mobile Tester',ai:'claude',vibe:'balanced',goals:['Understand concepts'],location:'',lat:null,lon:null,onboarded:true};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const results=[];
for(const [width,height] of sizes.filter(([w])=>process.argv[3]!=='wide'||w>=800))for(const theme of ['light','dark']){
const ctx=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true,colorScheme:theme,serviceWorkers:'block'});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await ctx.route('https://api.open-meteo.com/**',r=>r.fulfill({json:{current:{temperature_2m:24,weather_code:0,is_day:1},daily:{temperature_2m_min:[18,18],temperature_2m_max:[27,26],precipitation_probability_max:[10,20],weather_code:[0,2]}}}));
await p.addInitScript(({profile,theme})=>{localStorage.setItem('shh_skip_auth','1');localStorage.setItem('shh_profile',JSON.stringify(profile));localStorage.setItem('shh_theme',theme)}, {profile,theme});
await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('.app').waitFor();
for(const page of ['dashboard','chat','library','plan','flashcards','notes','pomodoro','settings']){
await p.evaluate(page=>sessionStorage.setItem('shh_active_page',page),page);await p.reload({waitUntil:'domcontentloaded'});await p.locator(`.app[data-page="${page}"]`).waitFor();await p.locator('.route-loading').waitFor({state:'hidden'});await p.waitForTimeout(600);
const name=`${page}-${width}x${height}-${theme}`;await p.screenshot({path:`${out}/${name}.png`});
const metrics=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,smallButtons:[...document.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<44||r.height<44)}).length}));results.push({name,...metrics,errors:[...errors]});
if(page==='pomodoro'){await p.getByRole('button',{name:'Full screen',exact:true}).click();await p.waitForTimeout(200);await p.screenshot({path:`${out}/fullscreen-${width}x${height}-${theme}.png`});results.push({name:`fullscreen-${width}-${theme}`, ...await p.evaluate(()=>({overflow:document.querySelector('.fullscreen-focus').scrollWidth>innerWidth}))});await p.getByRole('button',{name:'Close full screen'}).click()}
if(page==='settings')for(const tab of ['Preferences','Account']){const t=p.getByRole('tab',{name:tab,exact:true});if(await t.count()){await t.click();await p.screenshot({path:`${out}/settings-${tab}-${width}x${height}-${theme}.png`})}}
}
await p.evaluate(()=>window.dispatchEvent(new Event('shh:feedback')));await p.waitForTimeout(150);await p.screenshot({path:`${out}/feedback-${width}x${height}-${theme}.png`});
// Reduced visual viewport is a layout proxy, not a real on-screen keyboard.
await p.locator('#feedback-message').focus();await p.setViewportSize({width,height:Math.max(240,height-280)});await p.waitForTimeout(300);await p.screenshot({path:`${out}/feedback-keyboard-proxy-${width}x${height}-${theme}.png`});
await ctx.close();console.log(stage,width,theme)
}
const old=process.argv[3]==='wide'?JSON.parse(fs.readFileSync(`${out}/results.json`,'utf8')):[];const merged=[...new Map([...old,...results].map(r=>[r.name,r])).values()];fs.writeFileSync(`${out}/results.json`,JSON.stringify(merged,null,2));await b.close()})().catch(e=>{console.error(e);process.exit(1)})
