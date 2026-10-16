'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),{EventEmitter}=require('node:events');
const extend=require('../native-sync');
async function fixture(stored={}){
 const voices=[{name:'English',lang:'en-US'},{name:'Microsoft Sayaka - Japanese (Japan)',lang:'ja-JP'},{name:'日本語 B',lang:'ja-JP'}],calls=[];
 const synth={getVoices:()=>voices,speak:u=>calls.push({...u})},renderer=vm.createContext({window:{speechSynthesis:synth}}),app=new EventEmitter(),wc=new EventEmitter();
 wc.getURL=()=> 'file:///app/out/renderer/index.html';wc.isDestroyed=()=>false;wc.executeJavaScript=async code=>vm.runInContext(code,renderer);
 const source=fs.readFileSync(path.join(__dirname,'../plugin.js'),'utf8'),context=vm.createContext({URL,module:{exports:{}},require:n=>n==='electron'?{app,BrowserWindow:{getAllWindows:()=>[{id:1,webContents:wc}]}}:extend});vm.runInContext(source,context);const plugin=context.module.exports;
 const config={secret:'DO NOT LEAK',speech:{voice:'English',volume:.32,defaultEngine:'default'},integration:{voicevox:{enabled:true}}};
 const services=[{id:'a',name:'配信 A',url:'https://twitch.tv/private?secret=DO_NOT_LEAK',enabled:true,speech:true,options:{speechType:'default',voice:'English',voiceVolume:1.04,keep:'untouched'}},{id:'b',name:'配信 B',options:{voice:'ignored',voiceVolume:.99}},{id:'external',name:'外部',options:{speechType:'voicevox'}}];
 const writes=[];let fail=null;
 plugin.nativeRequest=async(method,route,body)=>{
  if(fail?.(method,route))throw Error('接続失敗');
  if(method==='GET')return structuredClone(route==='/api/config'?config:route==='/api/services'?services:services.find(s=>s.id===decodeURIComponent(route.split('/').pop()))||null);
  writes.push({method,route,body:structuredClone(body)});
  if(route==='/api/config')Object.assign(config.speech,body.speech);else Object.assign(services.find(s=>s.id===decodeURIComponent(route.split('/').pop())).options,body.options);return {};
 };
 const store={get:(k,f)=>stored[k]===undefined?f:stored[k],set:v=>Object.assign(stored,v)};plugin.init({store},{});await Promise.resolve();
 const get=async()=>{const p=await plugin.request({method:'GET'});assert.equal(p.code,200);return p.response;};
 const save=body=>plugin.request({method:'POST',body});
 const speak=async(text,id='a',volume=.32)=>{const u={text:await plugin.filterSpeech(text,null,{}, {id,service:'twitch'}),volume,voice:voices[0]};synth.speak(u);return u;};
 return {plugin,get,save,services,config,writes,stored,store,voices,speak,setFail:f=>fail=f};
}
(async()=>{
 const f=await fixture(),d=await f.get();assert.equal(d.migration,null);assert.equal(d.frames[0].normal.volume,1.04);assert.equal(d.frames[1].normal.volume,.32);assert.equal(d.frames[1].normal.voice,'English');assert.ok(!JSON.stringify(d).includes('DO NOT LEAK'));assert.ok(!JSON.stringify(d).includes('DO_NOT_LEAK'));assert.equal(f.writes.length,0);
 assert.equal((await f.speak('English')).volume,.32);assert.equal((await f.speak('日本語')).voice.name,f.voices[1].name);
 const row=d.frames[0];let response=await f.save({action:'save',frames:[{id:'a',token:row.token,japaneseToken:row.japaneseToken,normal:{volume:150},japanese:{voice:'@same',volume:25}}]});assert.equal(response.code,200);assert.equal(f.services[0].options.voiceVolume,1.5);assert.equal(f.services[0].options.keep,'untouched');assert.deepEqual(Object.keys(f.writes[0].body),['options']);assert.equal(f.stored.settingsVersion,2);assert.equal((await f.speak('日本語')).volume,.25);assert.equal((await f.speak('日本語')).voice.name,'English');assert.equal((await f.speak('Hello')).volume,.32);assert.equal((await f.speak('日本語','a',0)).volume,0);
 let fresh=await f.get(),r=fresh.frames[1];response=await f.save({action:'save',frames:[{id:'b',token:r.token,normal:{voice:f.voices[2].name}}]});assert.equal(response.code,200);assert.equal(f.services[1].options.speechType,'default');assert.equal(f.services[1].options.voiceVolume,.32);
 fresh=await f.get();f.config.speech.volume=.7;response=await f.save({action:'save',frames:[],base:{token:fresh.base.token,volume:50}});assert.equal(response.code,409);
 fresh=await f.get();response=await f.save({action:'save',frames:[],base:{token:fresh.base.token,volume:50}});assert.equal(response.code,200);assert.deepEqual(f.writes.at(-1).body,{speech:{volume:.5}});
 fresh=await f.get();r=fresh.frames[0];f.services[0].options.voiceVolume=.8;assert.equal((await f.save({action:'save',frames:[{id:'a',token:r.token,normal:{volume:20}}]})).code,409);
 const before=f.writes.length;for(const input of [{id:'external',normal:{volume:20}},{id:'missing',normal:{volume:20}},{id:'a',token:(await f.get()).frames[0].token,normal:{volume:201}},{id:'a',japaneseToken:(await f.get()).frames[0].japaneseToken,japanese:{volume:101}}])assert.notEqual((await f.save({action:'save',frames:[input]})).code,200);assert.equal(f.writes.length,before);
 fresh=await f.get();const request={action:'save',frames:[{id:'a',japaneseToken:fresh.frames[0].japaneseToken,japanese:{voice:'日本語 B',volume:0}}]};assert.equal((await f.save(request)).code,200);assert.equal((await f.save(request)).code,409);assert.equal((await f.speak('日本語')).volume,0);assert.equal((await f.speak('日本語')).voice.name,'日本語 B');assert.equal((await f.plugin.request({method:'PUT',body:{}})).code,405);
 f.config.integration.voicevox.enabled=false;assert.equal((await f.get()).frames[2].engine,'default');assert.match(await f.plugin.filterSpeech('hello',null,{}, {id:'external',service:'twitch'}),/OCFRAME/);f.config.integration.voicevox.enabled=true;await f.get();assert.equal(await f.plugin.filterSpeech('hello',null,{}, {id:'external',service:'twitch'}),'hello');
 f.plugin.destroy();
 const old={japaneseVoice:'日本語 B',normalVolume:60,japaneseVolume:40,sites:{twitch:{voice:'English'}},frames:{}};const g=await fixture(old),preview=await g.get();assert.ok(preview.migration);assert.equal(g.writes.length,0);assert.equal((await g.speak('English')).volume,.6);
 g.services[0].options.voiceVolume=.9;assert.equal((await g.save({action:'migrate',token:preview.migration.token})).code,409);assert.equal(g.writes.length,0);
 const current=await g.get();assert.equal((await g.save({action:'migrate',token:current.migration.token})).code,200);assert.equal(g.services[0].options.voiceVolume,.6);assert.equal((await g.get()).migration,null);assert.equal(g.stored.normalVolume,60);assert.equal((await g.speak('English')).volume,.32);assert.equal((await g.speak('日本語')).volume,.4);assert.equal((await g.speak('日本語')).voice.name,'日本語 B');g.plugin.destroy();
 const h=await fixture();const hd=await h.get();h.setFail((method,route)=>method==='PUT'&&route.endsWith('/b'));const partial=await h.save({action:'save',frames:hd.frames.slice(0,2).map(row=>({id:row.id,token:row.token,normal:{volume:30}}))});assert.equal(partial.code,500);assert.match(partial.response.error,/一部/);assert.equal(h.services[0].options.voiceVolume,.3);assert.equal(h.stored.settingsVersion,undefined);h.plugin.destroy();
 console.log('PASS: native sync, minimal writes, 200% volume, live changes/conflicts, privacy, Japanese only/mute, migration review/archive, external bypass, partial errors');
})().catch(e=>{console.error(e);process.exitCode=1});
