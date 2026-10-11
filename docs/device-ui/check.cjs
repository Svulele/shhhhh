const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const results=[];
try{for(const touch of [true,false]){
 const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1280,height:900},isMobile:touch,hasTouch:touch,serviceWorkers:'block'});
 await context.addInitScript(()=>{localStorage.setItem('shh_skip_auth','1');localStorage.setItem('shh_profile',JSON.stringify({name:'Device check',onboarded:true}));sessionStorage.setItem('shh_active_page','pomodoro')});await context.route('https://api.open-meteo.com/**',r=>r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4195');await page.getByRole('button',{name:'Full screen',exact:true}).click();const timer=page.getByRole('dialog',{name:'Full screen focus timer'});await timer.waitFor();
 if(touch)await timer.locator('.fullscreen-clock').tap();else await page.mouse.move(500,500);
 await page.getByText(touch?'Tap to start or pause':'Space to start or pause · Esc to return',{exact:true}).waitFor();
 assert.equal(await timer.locator('.kbd-hint').count(),touch?0:1);
 await page.screenshot({path:path.join(__dirname,touch?'timer-touch.png':'timer-desktop.png')});
 // A live data-input mutation must update only the hint, retaining the timer DOM.
 await timer.evaluate(e=>e.dataset.testIdentity='retained');await page.evaluate(()=>document.documentElement.dataset.input='keyboard');await timer.getByText('Space to start or pause · Esc to return',{exact:true}).waitFor();assert.equal(await timer.getAttribute('data-test-identity'),'retained');
 await page.evaluate(()=>document.documentElement.dataset.input='touch');await timer.getByText('Tap to start or pause',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 results.push({mode:touch?'touch':'desktop',liveHintUpdates:true,errors});await context.close();
}fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify(results,null,2));console.log(results)}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)})
