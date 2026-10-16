'use strict';
// Only fixed loopback endpoints are used. Full native responses never leave this module.
const http = require('node:http');
const { createHash } = require('node:crypto');
const token = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
function nativeRequest(method, path, body) {
  return new Promise((resolve,reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({hostname:'127.0.0.1',port:11180,path,method,headers:payload ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)} : {}}, res => {
      let data=''; res.setEncoding('utf8');
      res.on('data',part=>{data+=part;if(data.length>8*1024*1024)req.destroy(Error('本体の応答が大きすぎます'));});
      res.on('end',()=>{try{if(res.statusCode<200||res.statusCode>=300)throw Error();resolve(JSON.parse(data));}catch(_){reject(Error('本体APIから正常な応答がありません'));}});
      res.on('error',()=>reject(Error('本体APIとの接続が切れました')));
    });
    req.setTimeout(5000,()=>req.destroy(Error('本体APIの応答がありません')));
    req.on('error',()=>reject(Error('本体APIに接続できません。わんコメを起動してください')));
    req.end(payload);
  });
}
module.exports = (plugin, helpers) => {
  const legacyInit=plugin.init, legacySubscribe=plugin.subscribe;
  const availability=config=>({default:true,sapi5:process.platform==='win32'&&!!config?.speech?.sapi5?.enabled,yncNeo:!!config?.integration?.yncNeo?.enabled&&!!config?.integration?.yncNeo?.speech&&config?.integration?.yncNeo?.protocol==='ws',...Object.fromEntries(['bouyomichan','voicevox','coeiroink','aivisSpeech'].map(e=>[e,!!config?.integration?.[e]?.enabled]))});
  plugin.resolveEngine=function(service,config){if(!this.engineAvailability)return service?.options?.speechType||config?.defaultEngine||this.defaultEngine||'default';const e=service?.options?.speechType;return this.engineAvailability[e]?e:this.engineAvailability[this.defaultEngine]?this.defaultEngine:'default';};
  plugin.subscribe=function(type,data){legacySubscribe.call(this,type,data);if(type==='config'&&data?.speech)this.engineAvailability=availability(data);};
  plugin.defaultState={};
  plugin.nativeRequest=nativeRequest;
  plugin.init=function(api,data){
    legacyInit.call(this,api,data);
    if(data?.config?.speech)this.engineAvailability=availability(data.config);
    this.legacySettings=this.settings;
    const version=api.store.get('settingsVersion',null);
    this.migration=version!==2 && ['japaneseVoice','normalVolume','japaneseVolume','sites','frames'].some(k=>api.store.get(k,undefined)!==undefined);
    this.japaneseFrames=api.store.get('japaneseFrames',{});
    if(!this.japaneseFrames || typeof this.japaneseFrames!=='object'||Array.isArray(this.japaneseFrames))this.japaneseFrames={};
    this.japaneseFrames=Object.assign(Object.create(null),this.japaneseFrames);
    this.queue=Promise.resolve();
    if(!this.migration)this.activateNative();
  };
  plugin.activateNative=function(){this.settings={nativeSync:true,japaneseFrames:this.japaneseFrames};for(const {inject} of this.windows.values())void inject();};
  plugin.nativeSnapshot=async function(){
    const [config,services]=await Promise.all([this.nativeRequest('GET','/api/config'),this.nativeRequest('GET','/api/services')]);
    if(!config?.speech || !Array.isArray(services))throw Error('本体設定を読み込めませんでした');
    const speech=config.speech;
    // Engine availability follows the native fallback to the standard engine.
    this.engineAvailability=availability(config);this.defaultEngine=speech.defaultEngine||'default';
    const available=e=>this.engineAvailability[e]===true;
    const effective=s=>{const requested=s.options?.speechType;return available(requested)?requested:available(speech.defaultEngine)?speech.defaultEngine:'default';};
    const base={voice:typeof speech.voice==='string'?speech.voice:'',volume:typeof speech.volume==='number'?speech.volume:1,engine:speech.defaultEngine||'default'};
    const rows=helpers.publicFrames(services,this.observedSites,base.engine).map(row=>{
      const s=services.find(s=>s.id===row.id),engine=effective(s),o=s.options||{},active=o.speechType===engine;
      const normal={voice:active&&o.voice?o.voice:base.voice,volume:active&&Number.isFinite(o.voiceVolume)?o.voiceVolume:base.volume};
      return {...row,engine,normal,source:active&&(o.voice||Number.isFinite(o.voiceVolume))?'枠の本体設定':'本体の基本設定',token:token({base,options:o}),japanese:this.japaneseFrames[row.id]||{voice:'@auto',volume:null},japaneseToken:token(this.japaneseFrames[row.id]||null)};
    });
    this.services=services;return {base:{...base,token:token(base)},rows,services};
  };
  plugin.migrationPlan=function(snapshot){
    return snapshot.rows.filter(r=>r.engine==='default').map(r=>{
      const old=this.legacySettings,f=old.frames[r.id],rule=f?.override?f:old.sites[r.site]||{};
      return {id:r.id,name:r.name,before:r.normal,after:{voice:rule.voice||r.normal.voice,volume:(rule.normalVolume??old.normalVolume)===null?r.normal.volume:(rule.normalVolume??old.normalVolume)/100},japanese:{voice:rule.japaneseMode==='site'?'@same':rule.japaneseVoice||old.japaneseVoice||'@auto',volume:rule.japaneseVolume??old.japaneseVolume??null}};
    });
  };
  plugin.status=async function(snapshot){
    const windows=[];for(const {wc} of this.windows.values()){
      if(wc.isDestroyed()||!wc.getURL().startsWith('file:')||!/\/out\/renderer\//i.test(wc.getURL()))continue;
      try{windows.push(await wc.executeJavaScript('({installed:!!window.__onecommeAutoJapaneseSpeech_v1,voices:window.speechSynthesis.getVoices().map(v=>({name:v.name,lang:v.lang}))})'));}catch(_){}
    }
    const voices=[...new Map(windows.flatMap(w=>w.voices||[]).map(v=>[v.name,v])).values()];
    const plan=this.migration?this.migrationPlan(snapshot):null;
    return {version:this.version,base:snapshot.base,frames:snapshot.rows,voices,migration:plan?{plan,token:token({plan,tokens:snapshot.rows.map(r=>r.token)})}:null,installed:windows.some(w=>w.installed)};
  };
  plugin.mutate=async function(body){
    if(!body||typeof body!=='object'||Array.isArray(body))throw Error('保存内容が不正です');
    const snap=await this.nativeSnapshot(),status=await this.status(snap);
    const conflict=()=>{const e=Error('本体または別画面で設定が変わりました。最新の表示を確認してやり直してください');e.code=409;throw e;};
    const name=v=>{if(typeof v!=='string'||v.length>300||(!status.voices.some(x=>x.name===v)&&v!==snap.base.voice&&!snap.rows.some(r=>r.normal.voice===v)))throw Error('使用できる声を選んでください');return v;};
    const pct=(v,max)=>{if(!Number.isInteger(v)||v<0||v>max)throw Error(`音量は0〜${max}%の整数で指定してください`);return v/100;};
    let changes=[],basePatch=null,next=Object.assign(Object.create(null),this.japaneseFrames);
    if(body.action==='migrate'){
      if(!status.migration||body.token!==status.migration.token)conflict();
      changes=status.migration.plan.filter(r=>r.before.voice!==r.after.voice||r.before.volume!==r.after.volume).map(r=>({id:r.id,normal:r.after}));
      for(const r of status.migration.plan)next[r.id]=r.japanese;
    }else if(body.action==='save'){
      if(this.migration)throw Error('先に旧設定の移行内容を確認してください');
      if(!Array.isArray(body.frames)||body.frames.length>1000)throw Error('枠の保存内容が不正です');
      const seen=new Set();
      for(const input of body.frames){
        const row=snap.rows.find(r=>r.id===input.id);
        if(!row||seen.has(input.id)||row.engine!=='default')throw Error('編集できない枠が含まれています');seen.add(input.id);
        const change={id:input.id};
        if(input.normal){if(input.token!==row.token)conflict();change.normal={};if(own(input.normal,'voice'))change.normal.voice=name(input.normal.voice);if(own(input.normal,'volume'))change.normal.volume=pct(input.normal.volume,200);}
        if(input.japanese){
          if(input.japaneseToken!==row.japaneseToken)conflict();
          const value={...row.japanese};
          if(own(input.japanese,'voice')){const v=input.japanese.voice;if(!['@auto','@same'].includes(v)&&!status.voices.some(x=>x.name===v&&/^ja(?:[-_]|$)/i.test(x.lang)))throw Error('日本語の声を選んでください');value.voice=v;}
          if(own(input.japanese,'volume'))value.volume=input.japanese.volume===null?null:Math.round(pct(input.japanese.volume,100)*100);
          next[input.id]=value;
        }
        changes.push(change);
      }
      if(body.base){if(body.base.token!==snap.base.token)conflict();basePatch={};if(own(body.base,'voice'))basePatch.voice=name(body.base.voice);if(own(body.base,'volume'))basePatch.volume=pct(body.base.volume,200);}
    }else throw Error('保存操作が不正です');
    const applied=[];
    try{
      // Recheck immediately before each write; merge only into current native options.
      if(basePatch&&Object.keys(basePatch).length){const current=await this.nativeSnapshot();if(current.base.token!==snap.base.token)conflict();await this.nativeRequest('POST','/api/config',{speech:basePatch});applied.push('本体の基本設定');}
      for(const c of changes){
        if(!c.normal||!Object.keys(c.normal).length)continue;
        const latest=await this.nativeRequest('GET','/api/services/'+encodeURIComponent(c.id));
        const previous=snap.services.find(s=>s.id===c.id);
        if(!latest||token(latest.options||{})!==token(previous.options||{}))conflict();
        const options={...(latest.options||{}),speechType:'default'};
        // Inactive native voice fields were ignored before; do not activate stale values.
        if(latest.options?.speechType!=='default'){options.voice=basePatch?.voice??snap.base.voice;options.voiceVolume=basePatch?.volume??snap.base.volume;}
        if(own(c.normal,'voice'))options.voice=c.normal.voice;
        if(own(c.normal,'volume'))options.voiceVolume=c.normal.volume;
        await this.nativeRequest('PUT','/api/services/'+encodeURIComponent(c.id),{options});applied.push(snap.rows.find(r=>r.id===c.id).name);
      }
      this.api.store.set({settingsVersion:2,japaneseFrames:next});
      this.japaneseFrames=next;this.migration=false;this.activateNative();
      await Promise.all([...this.windows.values()].map(w=>w.inject()));
    }catch(e){if(applied.length){const error=Error('一部の本体設定は保存済みです。画面を更新して残りを確認してください：'+applied.join('、'));error.code=e.code||500;throw error;}throw e;}
  };
  plugin.request=async function(req){
    try{
      if(req.method==='POST'){
        const job=this.queue.then(()=>this.mutate(req.body));this.queue=job.catch(()=>{});await job;
      }else if(req.method!=='GET')return {code:405,response:{error:'設定画面を更新してください（GET / POST）'}};
      return {code:200,response:await this.status(await this.nativeSnapshot())};
    }catch(e){return {code:e.code||400,response:{error:e.message||'設定を保存できませんでした'}};}
  };
  return plugin;
};
