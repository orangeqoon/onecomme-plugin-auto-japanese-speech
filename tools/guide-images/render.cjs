'use strict';
// Developer only: NODE_PATH must contain Playwright; requires Microsoft Edge.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1400,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [file,name]of [['installation.html','01-installation.png'],['folder-layout.html','02-folder-layout.png']]){await page.goto(pathToFileURL(path.join(__dirname,file)).href);await page.screenshot({path:path.join(root,'docs/images',name),fullPage:true});}
 const voices=[{name:'English voice (example)',lang:'en-US'},{name:'Microsoft Sayaka - Japanese (Japan)',lang:'ja-JP'},{name:'Microsoft Haruka - Japanese (Japan)',lang:'ja-JP'}];
 let status={version:'2.0.0',installed:true,migration:null,voices,base:{voice:voices[0].name,volume:.8,token:'base'},frames:[{id:'demo-twitch',name:'Twitch 配信（例）',engine:'default',enabled:true,speech:true,normal:{voice:voices[0].name,volume:1.04},source:'枠の本体設定',token:'a',japaneseToken:'j',japanese:{voice:voices[1].name,volume:40}},{id:'demo-nico',name:'ニコニコ 配信（例）',engine:'default',enabled:true,speech:true,normal:{voice:voices[2].name,volume:.9},source:'枠の本体設定',token:'b',japaneseToken:'j',japanese:{voice:'@same',volume:null}},{id:'demo-fc2',name:'FC2 配信（例）',engine:'voicevox',enabled:false,speech:true,normal:{voice:voices[2].name,volume:1},source:'枠の本体設定',token:'c',japaneseToken:'j',japanese:{voice:'@auto',volume:null}}]};
 let saved;
 await page.route('http://127.0.0.1:19384/**',async route=>{
  if(route.request().url().includes('/api/plugins/')){
   if(route.request().method()==='POST'){saved=route.request().postDataJSON();for(const r of saved.frames||[]){const frame=status.frames.find(f=>f.id===r.id);if(r.normal){if(r.normal.voice)frame.normal.voice=r.normal.voice;if(r.normal.volume!==undefined)frame.normal.volume=r.normal.volume/100;}if(r.japanese)Object.assign(frame.japanese,r.japanese);}}
   return route.fulfill({json:{code:200,response:status}});
  }return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8')});
 });
 await page.goto('http://127.0.0.1:19384/');await page.locator('#frames tr').nth(2).waitFor();assert.equal(await page.locator('#frames tr').count(),3);assert.equal(await page.getByLabel('Twitch 配信（例） 通常の音量',{exact:true}).inputValue(),'104');assert.equal(await page.getByLabel('ニコニコ 配信（例） 日本語の音量',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('FC2 配信（例） 通常の声',{exact:true}).isDisabled(),true);
 await page.clock.install();const input=page.getByLabel('Twitch 配信（例） 日本語の音量',{exact:true});await input.fill('25');status.frames[1].normal.volume=.75;await page.clock.fastForward(5100);await page.waitForFunction(()=>document.querySelectorAll('#frames input')[2].value==='75');assert.equal(await input.inputValue(),'25');assert.equal(await page.getByLabel('ニコニコ 配信（例） 通常の音量',{exact:true}).inputValue(),'75');assert.equal(await input.evaluate(el=>el===document.activeElement),true);
 await page.locator('#save').click();await page.getByText('保存しました。本体の通常設定と日本語用設定に反映しました。',{exact:true}).waitFor();assert.deepEqual(saved.frames[0].japanese,{volume:25});assert.equal(saved.frames[0].normal,undefined);
 await input.fill('101');await page.locator('#save').click();assert.match(await page.locator('#message').textContent(),/範囲/);await input.fill('40');await page.locator('#save').click();
 await page.getByLabel('ニコニコ 配信（例） 日本語の声',{exact:true}).selectOption('@same');await page.getByLabel('ニコニコ 配信（例） 日本語の音量',{exact:true}).fill('0');await page.locator('#save').click();await page.getByText('保存しました。本体の通常設定と日本語用設定に反映しました。',{exact:true}).waitFor();assert.equal(saved.frames[0].japanese.volume,0);
 await page.locator('#editBase').click();await page.locator('#baseVolume').fill('70');await page.locator('#baseApply').click();assert.equal(await page.locator('#baseDialog').evaluate(e=>e.open),false);await page.locator('#save').click();assert.equal(saved.base.volume,70);
 // Migration remains a separate explicit confirmation.
 status.migration={token:'migration',plan:[{id:'demo-twitch',name:'Twitch 配信（例）',before:{voice:voices[0].name,volume:1.04},after:{voice:voices[0].name,volume:.8}}]};await page.clock.fastForward(5100);await page.waitForFunction(()=>!document.getElementById('migration').hidden);assert.equal(await input.isDisabled(),true);await page.locator('#review').click();assert.equal(await page.locator('#migrationRows tr').count(),1);await page.locator('#migrationClose').click();status.migration=null;await page.clock.fastForward(5100);await page.waitForFunction(()=>document.getElementById('migration').hidden);
 status.frames[1].normal.volume=.9;status.frames[1].japanese.volume=null;await page.clock.fastForward(5100);await page.waitForFunction(()=>document.querySelectorAll('#frames input')[2].value==='90');
 await page.evaluate(()=>{const p=document.createElement('p');p.textContent='設定画面の見本：枠名・音声一覧は説明用サンプルです。';p.style.cssText='background:#e4ebff;padding:14px;border-radius:8px';document.body.prepend(p);});
 await page.screenshot({path:path.join(root,'docs/images/03-voice-settings.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'docs/images/04-mobile-settings.png'),fullPage:true});assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile UI, 104% native display, independent Japanese edits, polling/focus, validation, zero, minimal save, base edit and migration review. Guide screenshots generated.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
