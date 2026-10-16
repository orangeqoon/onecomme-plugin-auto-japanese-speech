'use strict';
const KEY = '__onecommeAutoJapaneseSpeech_v1';
const SITES = ['niconama', 'fc2', 'twitch', 'kick', 'twicas', 'youtube', 'other'];
function normalizeSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('設定形式が不正です');
  const voice = v => { if (v === undefined) return ''; if (typeof v !== 'string' || v.length > 300) throw new Error('音声名が不正です'); return v; };
  if (input.sites !== undefined && (!input.sites || typeof input.sites !== 'object' || Array.isArray(input.sites))) throw new Error('サイト設定が不正です');
  const out = { japaneseVoice: voice(input.japaneseVoice), sites: {} };
  for (const site of SITES) {
    const r = input.sites?.[site] || {};
    if (typeof r !== 'object' || Array.isArray(r)) throw new Error('サイト設定が不正です');
    if (r.japaneseMode !== undefined && !['auto', 'site'].includes(r.japaneseMode)) throw new Error('日本語設定が不正です');
    out.sites[site] = { voice: voice(r.voice), japaneseVoice: voice(r.japaneseVoice), japaneseMode: r.japaneseMode || 'auto' };
  }
  return out;
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
    const site = match ? match[1] : 'other';
    if (match) utterance.text = utterance.text.slice(match[0].length);
    const rule = state.settings.sites?.[site] || {};
    const voices = synth.getVoices();
    let selected;
    if (utterance && rule.japaneseMode !== 'site' && /[\u3041-\u3096\u30a1-\u30fa\uff66-\uff9d\u3400-\u4dbf\u4e00-\u9fff]/u.test(utterance.text || '')) {
      const ja = voices.filter(v => /^ja(?:[-_]|$)/i.test(v.lang));
      selected = ja.find(v => v.name === rule.japaneseVoice) || ja.find(v => v.name === state.settings.japaneseVoice) || ja.find(v => /Sayaka/i.test(v.name)) || ja[0];
      if (!selected) state.missing++;
    }
    if (!selected && rule.voice) {
      selected = voices.find(v => v.name === rule.voice);
      if (!selected) state.missing++;
    }
    if (selected) { utterance.voice = selected; utterance.lang = selected.lang; state.switched++; }
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
  name: '日本語コメント音声切替', uid: 'local.onecomme.auto-japanese-speech', version: '1.1.0', author: 'orangeqoon',
  url: 'http://localhost:11180/plugins/local.onecomme.auto-japanese-speech/',
  permissions: ['filter.speech', 'services'],
  defaultState: { japaneseVoice: 'Microsoft Sayaka - Japanese (Japan)', sites: {} },
  init(api, initialData = {}) {
    const { app, BrowserWindow } = require('electron');
    this.services = initialData.services || []; this.api = api; this.windows = new Map(); this.active = true; this.app = app;
    this.settings = normalizeSettings({ japaneseVoice: api.store.get('japaneseVoice', this.defaultState.japaneseVoice), sites: api.store.get('sites', {}) });
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
  subscribe(type, services) { if (type === 'services' && Array.isArray(services)) this.services = services; },
  async filterSpeech(text, _user, config, comment) {
    if (typeof text !== 'string' || !text.trim()) return text;
    const service = this.services?.find(s => s.id === comment?.id);
    const engine = service?.options?.speechType || config?.defaultEngine || 'default';
    if (engine !== 'default') return text;
    // Carry site metadata with each utterance, never a global last-site or text lookup.
    const body = text.replace(/^\u2063OCSITE:(niconama|fc2|twitch|kick|twicas|youtube|other)\u2063/u, '');
    return `\u2063OCSITE:${siteKey(comment)}\u2063${body}`;
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
      try { next = normalizeSettings(req.body); } catch (e) { return { code: 400, response: { error: e.message } }; }
      try { this.api.store.set({ japaneseVoice: next.japaneseVoice, sites: next.sites }); this.settings = next; }
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
    return { code: 200, response: { version: this.version, settings: this.settings, windows } };
  }
};
module.exports = plugin;
