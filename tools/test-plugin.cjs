const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const path=require('path');
const source=fs.readFileSync(path.resolve(__dirname,'../plugin.js'),'utf8');
const calls=[];let voices=[{name:'English',lang:'en-US'},{name:'Microsoft Sayaka - Japanese (Japan)',lang:'ja-JP'}];
const synth={getVoices:()=>voices,speak(u){calls.push(u)}};
const context={window:{speechSynthesis:synth},module:{exports:{}}};vm.createContext(context);
vm.runInContext(source+';module.exports.test={installInRenderer,removeFromRenderer}',context);
const {installInRenderer:install,removeFromRenderer:remove}=context.module.exports.test;
const original=synth.speak;install({japaneseVoice:voices[1].name});
for(const text of ['こんにちは','日本語','カタカナ','ﾊﾛｰ','Hello 日本語']){const u={text,voice:voices[0],rate:1.2,volume:.32};synth.speak(u);assert.equal(u.voice,voices[1]);assert.equal(u.rate,1.2);assert.equal(u.volume,.32)}
for(const text of ['Hello world','Bonjour','안녕하세요','123 😀']){const u={text,voice:voices[0]};synth.speak(u);assert.equal(u.voice,voices[0])}
const wrapper=synth.speak;install({});assert.equal(synth.speak,wrapper);
voices=[];const u={text:'日本語',voice:{name:'original'}};synth.speak(u);assert.equal(u.voice.name,'original');
remove();assert.equal(synth.speak,original);assert.equal(calls.length,10);
console.log('PASS: Japanese, English, other languages, mixed text, missing voice, idempotence, cleanup, rate and volume (10 utterances)');
