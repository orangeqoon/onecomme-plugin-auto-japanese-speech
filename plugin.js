'use strict';
const KEY = '__onecommeAutoJapaneseSpeech_v1';
const SITES = ['niconama', 'fc2', 'twitch', 'kick', 'twicas', 'youtube', 'other'];
function normalizeSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('設定形式が不正です');
  const voice = v => { if (v === undefined) return ''; if (typeof v !== 'string' || v.length > 300) throw new Error('音声名が不正です'); return v; };
  const volume = v => { if (v === undefined || v === null) return null; if (!Number.isInteger(v) || v < 0 || v > 100) throw new Error('音量は0から100の整数、または未指定にしてください'); return v; };
  const dictionary = v => { if (v === undefined) return {}; if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('設定一覧が不正です'); return v; };
  const rule = r => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('音声設定が不正です');
    if (r.japaneseMode !== undefined && !['auto', 'site'].includes(r.japaneseMode)) throw new Error('日本語設定が不正です');
    return { voice: voice(r.voice), japaneseVoice: voice(r.japaneseVoice), japaneseMode: r.japaneseMode || 'auto', normalVolume: volume(r.normalVolume), japaneseVolume: volume(r.japaneseVolume) };
  };
  const out = { japaneseVoice: voice(input.japaneseVoice), normalVolume: volume(input.normalVolume), japaneseVolume: volume(input.japaneseVolume), sites: {}, frames: Object.create(null) };
  const sites = dictionary(input.sites);
  for (const site of SITES) out.sites[site] = rule(sites[site] === undefined ? {} : sites[site]);
  const frames = Object.entries(dictionary(input.frames));
  if (frames.length > 1000) throw new Error('枠の設定が多すぎます');
  for (const [id, r] of frames) {
    if (!id || id.length > 200 || /[\u0000-\u001f\u2063]/u.test(id)) throw new Error('枠IDが不正です');
    if (r?.override !== undefined && typeof r.override !== 'boolean') throw new Error('枠設定の切替が不正です');
    out.frames[id] = { ...rule(r), override: r.override === true };
  }
  return out;
}
function publicFrames(services, observed, defaultEngine) {
  return (Array.isArray(services) ? services : []).filter(s => s && typeof s.id === 'string').map(s => {
    let site = observed?.get(s.id) || 'other';
    if (site === 'other') {
      try {
        const host = new URL(s.url || s.meta?.url || '').hostname.toLowerCase();
        const domains = { 'nicovideo.jp':'niconama', 'youtube.com':'youtube', 'youtu.be':'youtube', 'twitch.tv':'twitch', 'kick.com':'kick', 'twitcasting.tv':'twicas', 'fc2.com':'fc2' };
        for (const [domain, key] of Object.entries(domains)) if (host === domain || host.endsWith('.'+domain)) { site = key; break; }
      } catch (_) { /* Blank URLs are valid for injected comment services. */ }
    }
    return { id: s.id, name: typeof s.name === 'string' && s.name ? s.name : '名前のない枠', site, enabled: s.enabled === true, speech: s.speech === true, engine: s.options?.speechType || defaultEngine || 'default' };
  });
}
function siteKey(comment) {
  const raw = typeof comment?.service === 'string' ? comment.service.toLowerCase() : '';
  return ({ niconico: 'niconama', nicolive: 'niconama', fc2live: 'fc2', twitcasting: 'twicas' })[raw] || (SITES.includes(raw) ? raw : 'other');
}
function installInRenderer(settings) {
  const key = '__onecommeAutoJapaneseSpeech_v1';
  const synth = window.speechSynthesis;
  if (!synth) return { installed: false };
  if (window[key]) { window[key].settings = settings; return { installed: true }; }
  const state = { settings, original: synth.speak, switched: 0, missing: 0 };
  state.wrapper = function (utterance) {
    const match = utterance && /^\u2063OCSITE:(niconama|fc2|twitch|kick|twicas|youtube|other)\u2063/u.exec(utterance.text || '');
    const frameMatch = utterance && /^\u2063OCFRAME:(niconama|fc2|twitch|kick|twicas|youtube|other):([^\u2063]{0,1500})\u2063/u.exec(utterance.text || '');
    const site = frameMatch ? frameMatch[1] : match ? match[1] : 'other';
    let id = '';
    if (frameMatch) { try { id = decodeURIComponent(frameMatch[2]); } catch (_) {} }
    if (frameMatch || match) utterance.text = utterance.text.slice((frameMatch || match)[0].length);
    const frameRule = Object.prototype.hasOwnProperty.call(state.settings.frames || {}, id) ? state.settings.frames[id] : null;
    const rule = frameRule?.override ? frameRule : state.settings.sites?.[site] || {};
    const voices = synth.getVoices();
    let selected;
    const isJapanese = !!utterance && /[\u3041-\u3096\u30a1-\u30fa\uff66-\uff9d\u3400-\u4dbf\u4e00-\u9fff]/u.test(utterance.text || '');
    if (isJapanese && rule.japaneseMode !== 'site') {
      const ja = voices.filter(v => /^ja(?:[-_]|$)/i.test(v.lang));
      selected = ja.find(v => v.name === rule.japaneseVoice) || ja.find(v => v.name === state.settings.japaneseVoice) || ja.find(v => /Sayaka/i.test(v.name)) || ja[0];
      if (!selected) state.missing++;
    }
    if (!selected && rule.voice) {
      selected = voices.find(v => v.name === rule.voice);
      if (!selected) state.missing++;
    }
    if (selected) { utterance.voice = selected; utterance.lang = selected.lang; state.switched++; }
    const field = isJapanese ? 'japaneseVolume' : 'normalVolume';
    const configuredVolume = rule[field] ?? state.settings[field];
    // Explicit percentages override nonzero volume, but never unmute a muted utterance.
    if (utterance && utterance.volume !== 0 && Number.isInteger(configuredVolume) && configuredVolume >= 0 && configuredVolume <= 100) utterance.volume = configuredVolume / 100;
    return state.original.call(synth, utterance);
  };
  synth.speak = state.wrapper;
  window[key] = state;
  return { installed: synth.speak === state.wrapper };
}
function removeFromRenderer() {
  const key = '__onecommeAutoJapaneseSpeech_v1';
  const state = window[key];
  if (state && window.speechSynthesis.speak === state.wrapper) { window.speechSynthesis.speak = state.original; delete window[key]; }
}
const plugin = {
  name: '日本語コメント音声切替', uid: 'local.onecomme.auto-japanese-speech', version: '1.3.0', author: 'orangeqoon',
  url: 'http://localhost:11180/plugins/local.onecomme.auto-japanese-speech/',
  permissions: ['filter.speech', 'services', 'config'],
  defaultState: { japaneseVoice: 'Microsoft Sayaka - Japanese (Japan)', normalVolume: null, japaneseVolume: null, sites: {}, frames: {} },
  init(api, initialData = {}) {
    const { app, BrowserWindow } = require('electron');
    this.services = Array.isArray(initialData.services) ? initialData.services : []; this.observedSites = new Map(); this.defaultEngine = initialData.config?.speech?.defaultEngine || 'default'; this.api = api; this.windows = new Map(); this.active = true; this.app = app;
    this.settings = normalizeSettings({ japaneseVoice: api.store.get('japaneseVoice', this.defaultState.japaneseVoice), normalVolume: api.store.get('normalVolume', null), japaneseVolume: api.store.get('japaneseVolume', null), sites: api.store.get('sites', {}), frames: api.store.get('frames', {}) });
    this.attach = win => {
      if (!this.active || this.windows.has(win.id)) return;
      const wc = win.webContents;
      const inject = async () => {
        if (!this.active || wc.isDestroyed()) return;
        if (!wc.getURL().startsWith('file:') || !/\/out\/renderer\//i.test(wc.getURL())) return;
        try { await wc.executeJavaScript(`(${installInRenderer.toString()})(${JSON.stringify(this.settings)})`); }
        catch (err) { this.api.log?.error?.('[AutoJapanese] install failed', String(err)); }
      };
      this.windows.set(win.id, { wc, inject }); wc.on('did-finish-load', inject);
      wc.once('destroyed', () => this.windows.delete(win.id)); void inject();
    };
    this.created = (_event, win) => this.attach(win);
    app.on('browser-window-created', this.created); BrowserWindow.getAllWindows().forEach(this.attach);
  },
  subscribe(type, data) {
    if (type === 'services' && Array.isArray(data)) this.services = data;
    if (type === 'config' && data?.speech) this.defaultEngine = data.speech.defaultEngine || 'default';
  },
  async filterSpeech(text, _user, config, comment) {
    if (typeof text !== 'string' || !text.trim()) return text;
    const service = this.services?.find(s => s.id === comment?.id);
    const engine = service?.options?.speechType || config?.defaultEngine || this.defaultEngine || 'default';
    if (engine !== 'default') return text;
    const site = siteKey(comment);
    const id = typeof comment?.id === 'string' && comment.id.length <= 200 && !/[\u0000-\u001f\u2063]/u.test(comment.id) ? comment.id : '';
    if (id) this.observedSites.set(id, site);
    // Each utterance carries its own stable frame ID; frame names may change.
    const body = text.replace(/^\u2063(?:OCSITE:(?:niconama|fc2|twitch|kick|twicas|youtube|other)|OCFRAME:(?:niconama|fc2|twitch|kick|twicas|youtube|other):[^\u2063]{0,1500})\u2063/u, '');
    return `\u2063OCFRAME:${site}:${encodeURIComponent(id)}\u2063${body}`;
  },
  destroy() {
    this.active = false; this.app?.removeListener('browser-window-created', this.created);
    for (const { wc, inject } of this.windows?.values() || []) {
      if (wc.isDestroyed()) continue; wc.removeListener('did-finish-load', inject);
      void wc.executeJavaScript(`(${removeFromRenderer.toString()})()`).catch(() => {});
    }
    this.windows?.clear();
  },
  async request(req) {
    if (req.method === 'PUT') {
      let next;
      try { if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new Error('設定形式が不正です'); next = normalizeSettings({ ...req.body, normalVolume: req.body.normalVolume === undefined ? this.settings.normalVolume : req.body.normalVolume, japaneseVolume: req.body.japaneseVolume === undefined ? this.settings.japaneseVolume : req.body.japaneseVolume, frames: req.body?.frames === undefined ? this.settings.frames : req.body.frames }); } catch (e) { return { code: 400, response: { error: e.message } }; }
      try { this.api.store.set({ japaneseVoice: next.japaneseVoice, normalVolume: next.normalVolume, japaneseVolume: next.japaneseVolume, sites: next.sites, frames: next.frames }); this.settings = next; }
      catch (_) { return { code: 500, response: { error: '設定を保存できませんでした' } }; }
      await Promise.all(Array.from(this.windows.values(), ({ inject }) => inject()));
    } else if (req.method !== 'GET') return { code: 405, response: { error: 'GET / PUT only' } };
    const windows = [];
    for (const { wc } of this.windows?.values() || []) {
      if (wc.isDestroyed() || !wc.getURL().startsWith('file:') || !/\/out\/renderer\//i.test(wc.getURL())) continue;
      try {
        windows.push(await wc.executeJavaScript(`(() => { const s = window[${JSON.stringify(KEY)}]; return { installed: !!s, switched: s?.switched || 0, missing: s?.missing || 0, voices: window.speechSynthesis.getVoices().map(v => ({name:v.name,lang:v.lang})) }; })()`));
      } catch (_) { /* Window closed during status request. */ }
    }
    return { code: 200, response: { version: this.version, settings: this.settings, services: publicFrames(this.services, this.observedSites, this.defaultEngine), windows } };
  }
};
module.exports = plugin;
