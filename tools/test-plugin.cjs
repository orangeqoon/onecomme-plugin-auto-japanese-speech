'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),{EventEmitter}=require('events');
const source=fs.readFileSync(path.resolve(__dirname,'../plugin.js'),'utf8');
async function main(){
 const calls=[];let voices=[{name:'English A',lang:'en-US'},{name:'English B',lang:'en-GB'},{name:'Microsoft Sayaka - Japanese (Japan)',lang:'ja-JP'},{name:'Japanese B',lang:'ja-JP'}];
 const synth={getVoices:()=>voices,speak(u){calls.push({...u})}};
 const renderer={window:{speechSynthesis:synth}};vm.createContext(renderer);
 const app=new EventEmitter(),wc=new EventEmitter();wc.getURL=()=> 'file:///app/out/renderer/index.html';wc.isDestroyed=()=>false;wc.executeJavaScript=async script=>vm.runInContext(script,renderer);
 const stored={};const store={get:(k,f)=>stored[k]??f,set:values=>Object.assign(stored,values)};
 const ctx={URL,module:{exports:{}},require:name=>{assert.equal(name,'electron');return {app,BrowserWindow:{getAllWindows:()=>[{id:1,webContents:wc}]}}}};vm.createContext(ctx);
 vm.runInContext(source+';module.exports.test={installInRenderer,removeFromRenderer,normalizeSettings,siteKey}',ctx);
 const plugin=ctx.module.exports,helpers=plugin.test;const original=synth.speak;
 plugin.init({store},{});await Promise.resolve();
 function speak(text,volume=.32){const u={text,voice:voices[0],rate:1.2,volume,pitch:.9};synth.speak(u);return u}
 for(const text of ['こんにちは','日本語','カタカナ','ﾊﾛｰ','Hello 日本語'])assert.equal(speak(text).voice,voices[2]);
 for(const text of ['Hello world','Bonjour','안녕하세요','123 😀'])assert.equal(speak(text).voice,voices[0]);
 const settings={japaneseVoice:voices[2].name,sites:{twitch:{voice:'English A',japaneseVoice:'Japanese B'},kick:{voice:'English B'},niconama:{voice:'Japanese B',japaneseMode:'site'},fc2:{voice:'Japanese B',japaneseMode:'site'},twicas:{voice:'Japanese B',japaneseMode:'site'}}};
 const saved=await plugin.request({method:'PUT',body:settings});assert.equal(saved.code,200);assert.equal(stored.sites.kick.voice,'English B');assert.equal(saved.response.windows[0].voices.length,4);
 const texts=await Promise.all(['twitch','kick','twitch'].map(site=>plugin.filterSpeech('same text',null,{}, {service:site})));
 assert.deepEqual(texts.map(t=>speak(t).voice.name),['English A','English B','English A']);
 assert.equal(speak(await plugin.filterSpeech('こんにちは',null,{}, {service:'twitch'})).voice.name,'Japanese B');
 assert.equal(speak(await plugin.filterSpeech('こんにちは',null,{}, {service:'kick'})).voice.name,voices[2].name);
 for(const site of ['niconama','fc2','twicas'])assert.equal(speak(await plugin.filterSpeech('hello 日本語',null,{}, {service:site})).voice.name,'Japanese B');
 for(const [alias,key] of [['niconico','niconama'],['fc2live','fc2'],['twitcasting','twicas']])assert.equal(helpers.siteKey({service:alias}),key);
 assert.equal(helpers.siteKey({service:'unknown'}),'other');
 assert.equal(await plugin.filterSpeech('',null,{}, {service:'twitch'}),'');
 const twice=await plugin.filterSpeech(texts[0],null,{}, {service:'kick'});assert.equal((twice.match(/OC(?:SITE|FRAME):/g)||[]).length,1);
 assert.equal(await plugin.filterSpeech('hello',null,{defaultEngine:'voicevox'},{service:'twitch'}),'hello');
 plugin.subscribe('services',[{id:'fc2-custom',options:{speechType:'bouyomichan'}}]);assert.equal(await plugin.filterSpeech('hello',null,{}, {id:'fc2-custom',service:'fc2'}),'hello');
 const fallback=speak('plain');assert.equal(fallback.rate,1.2);assert.equal(fallback.volume,.32);assert.equal(fallback.pitch,.9);
 assert.ok(calls.every(u=>!u.text.includes('OCSITE:')&&!u.text.includes('OCFRAME:')));
 // Frame IDs, rather than names/site/text, select the override.
 const frames=[{id:'kick-a',name:'同じ枠名',url:'https://kick.com/channel?token=do-not-leak',enabled:true,speech:true,options:{speechType:'default'},meta:{private:'do-not-leak'}},{id:'kick-b',name:'同じ枠名',url:'https://kick.com/second',enabled:false,speech:false,options:{speechType:'default'}},{id:'unicode:枠/1',name:'別のサイト',url:'',enabled:false,speech:true,options:{speechType:'default'}}];
 plugin.subscribe('services',frames);
 const frameSettings={...settings,frames:{'kick-a':{override:true,voice:'English A',japaneseVoice:'Japanese B'},'kick-b':{override:true,voice:'English B',japaneseMode:'site'},'unicode:枠/1':{override:true,voice:'Japanese B',japaneseMode:'site'},'deleted-frame':{override:true,voice:'Japanese B'}}};
 const frameSave=await plugin.request({method:'PUT',body:frameSettings});assert.equal(frameSave.code,200);assert.equal(frameSave.response.services.length,3);assert.equal(frameSave.response.services[0].site,'kick');assert.equal(frameSave.response.services[1].speech,false);assert.ok(!JSON.stringify(frameSave.response.services).includes('do-not-leak'));
 const queued=await Promise.all(['kick-a','kick-b','kick-a'].map(id=>plugin.filterSpeech('same',null,{}, {id,service:'kick'})));
 assert.deepEqual(queued.map(t=>speak(t).voice.name),['English A','English B','English A']);
 assert.equal(speak(await plugin.filterSpeech('日本語',null,{}, {id:'kick-a',service:'kick'})).voice.name,'Japanese B');assert.equal(speak(await plugin.filterSpeech('日本語',null,{}, {id:'kick-b',service:'kick'})).voice.name,'English B');
 assert.equal(speak(await plugin.filterSpeech('hello',null,{}, {id:'unicode:枠/1',service:'unknown'})).voice.name,'Japanese B');
 plugin.subscribe('services',[{...frames[1],name:'改名した枠'},frames[0],frames[2]]);assert.equal((await plugin.request({method:'GET'})).response.services[0].name,'改名した枠');assert.equal(speak(await plugin.filterSpeech('same',null,{}, {id:'kick-b',service:'kick'})).voice.name,'English B');
 // Unconfigured/new frames inherit the site rule; explicit inheritance also works.
 assert.equal(speak(await plugin.filterSpeech('same',null,{}, {id:'new-frame',service:'kick'})).voice.name,'English B');
 await plugin.request({method:'PUT',body:{...frameSettings,frames:{...frameSettings.frames,'kick-a':{override:false,voice:'English A'}}}});assert.equal(speak(await plugin.filterSpeech('same',null,{}, {id:'kick-a',service:'kick'})).voice.name,'English B');
 await plugin.request({method:'PUT',body:settings});assert.equal(stored.frames['deleted-frame'].voice,'Japanese B');
 for(const body of [null,[],{frames:[]},{frames:{x:{override:'true'}}},{frames:{x:null}},{frames:{['x'.repeat(201)]:{}}}])assert.equal((await plugin.request({method:'PUT',body})).code,400);
 const proto=helpers.normalizeSettings(JSON.parse('{"frames":{"__proto__":{"override":true,"voice":"Japanese B"}}}'));assert.equal(Object.getPrototypeOf(proto.frames),null);assert.equal(proto.frames['__proto__'].voice,'Japanese B');
 assert.equal(speak('\u2063OCSITE:kick\u2063legacy').text,'legacy');
 assert.equal(speak('\u2063OCFRAME:kick:%broken\u2063hello').text,'hello');
 plugin.subscribe('config',{speech:{defaultEngine:'voicevox'}});assert.equal(await plugin.filterSpeech('hello',null,{}, {id:'new-frame',service:'kick'}),'hello');plugin.subscribe('config',{speech:{defaultEngine:'default'}});
 const finalStatus=await plugin.request({method:'GET'});assert.ok(finalStatus.response.services.every(s=>!('url' in s)&&!('meta' in s)&&!('options' in s)));assert.equal(stored.frames['deleted-frame'].voice,'Japanese B');
 // Shared and per-rule percentages are independent of the chosen voice.
 const volumeSettings={...settings,normalVolume:80,japaneseVolume:35};
 await plugin.request({method:'PUT',body:volumeSettings});assert.equal(speak('Hello').volume,.8);assert.equal(speak('Bonjour').volume,.8);assert.equal(speak('안녕하세요').volume,.8);assert.equal(speak('こんにちは').volume,.35);assert.equal(speak('Hello 日本語').volume,.35);
 assert.equal(speak(await plugin.filterSpeech('日本語',null,{}, {service:'niconama'})).volume,.35);
 const perFrame={...volumeSettings,sites:{...settings.sites,kick:{voice:'English B',normalVolume:50,japaneseVolume:45}},frames:{...stored.frames,'volume-frame':{override:true,voice:'English A',japaneseMode:'site',normalVolume:60,japaneseVolume:20},'silent-frame':{override:true,normalVolume:100,japaneseVolume:0}}};
 await plugin.request({method:'PUT',body:perFrame});
 const volumeText=await plugin.filterSpeech('日本語',null,{}, {id:'volume-frame',service:'kick'});const japaneseSameVoice=speak(volumeText);assert.equal(japaneseSameVoice.voice.name,'English A');assert.equal(japaneseSameVoice.volume,.2);
 assert.equal(speak(await plugin.filterSpeech('hello',null,{}, {id:'volume-frame',service:'kick'})).volume,.6);
 assert.equal(speak(await plugin.filterSpeech('hello',null,{}, {id:'unconfigured',service:'kick'})).volume,.5);assert.equal(speak(await plugin.filterSpeech('日本語',null,{}, {id:'unconfigured',service:'kick'})).volume,.45);
 assert.equal(speak(await plugin.filterSpeech('日本語',null,{}, {id:'silent-frame',service:'kick'})).volume,0);assert.equal(speak(await plugin.filterSpeech('hello',null,{}, {id:'silent-frame',service:'kick'})).volume,1);
 assert.equal(speak(await plugin.filterSpeech('hello',null,{}, {id:'silent-frame',service:'kick'}),0).volume,0);assert.equal(speak('日本語',0).volume,0);
 const invalidVolumes=[-1,101,50.5,'50',false,NaN,Infinity];const volumeSnapshot=JSON.stringify(stored);
 for(const v of invalidVolumes){for(const body of [{normalVolume:v},{japaneseVolume:v},{sites:{kick:{normalVolume:v}}},{frames:{x:{override:true,japaneseVolume:v}}}])assert.equal((await plugin.request({method:'PUT',body})).code,400)}assert.equal(JSON.stringify(stored),volumeSnapshot);
 const legacy=helpers.normalizeSettings(settings);assert.equal(legacy.normalVolume,null);assert.equal(legacy.japaneseVolume,null);assert.equal(legacy.sites.kick.normalVolume,null);
 // Old API clients omit the shared fields: do not reset the user's shared volumes.
 await plugin.request({method:'PUT',body:settings});assert.equal(stored.normalVolume,80);assert.equal(stored.japaneseVolume,35);
 await plugin.request({method:'PUT',body:{...settings,normalVolume:null,japaneseVolume:null}});assert.equal(speak('hello').volume,.32);assert.equal(speak('日本語').volume,.32);
 await plugin.request({method:'PUT',body:volumeSettings});
 const before=JSON.stringify(stored);assert.equal((await plugin.request({method:'PUT',body:{sites:{kick:{japaneseMode:'bad'}}}})).code,400);assert.equal(JSON.stringify(stored),before);
 const previous=plugin.settings;store.set=()=>{throw Error('disk failure')};assert.equal((await plugin.request({method:'PUT',body:settings})).code,500);assert.equal(plugin.settings,previous);store.set=values=>Object.assign(stored,values);
 assert.equal((await plugin.request({method:'POST'})).code,405);
 const wrapper=synth.speak;await wc.executeJavaScript(`(${helpers.installInRenderer.toString()})(${JSON.stringify(settings)})`);assert.equal(synth.speak,wrapper);
 const available=voices;voices=[];assert.equal(speak('日本語').voice,undefined);voices=available;
 plugin.destroy();await Promise.resolve();assert.equal(synth.speak,original);assert.equal(app.listenerCount('browser-window-created'),0);assert.equal(wc.listenerCount('did-finish-load'),0);
 plugin.init({store},{});await Promise.resolve();assert.equal(plugin.settings.normalVolume,80);assert.equal(plugin.settings.japaneseVolume,35);assert.equal(plugin.settings.sites.kick.voice,'English B');assert.equal(plugin.settings.frames['deleted-frame'].voice,'Japanese B');assert.equal(speak(await plugin.filterSpeech('same text',null,{}, {service:'kick'})).voice.name,'English B');plugin.destroy();
 console.log('PASS: normal/Japanese volumes, zero, global/site/frame inheritance, mute preservation, migration, persistence, strict validation and frame ID routing/rename/same names/Unicode/inheritance/discovery/privacy and legacy language routing, identical queued site texts, Japanese/site overrides, aliases, external engine bypass, metadata stripping, validation, persistence/restart, save failure, lifecycle cleanup and speech properties');
}
main().catch(e=>{console.error(e);process.exitCode=1});
