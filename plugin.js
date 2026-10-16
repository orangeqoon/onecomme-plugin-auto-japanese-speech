'use strict';

// OneComme 9.2.0-beta.0: filterSpeech config is copied and discarded for comments.
// Select the voice at the existing Web Speech playback boundary instead.
const KEY = '__onecommeAutoJapaneseSpeech_v1';
function installInRenderer(settings) {
  const key = '__onecommeAutoJapaneseSpeech_v1';
  const synth = window.speechSynthesis;
  if (!synth) return { installed: false };
  const previous = window[key];
  if (previous) { previous.settings = settings; return { installed: true }; }
  const state = { settings, original: synth.speak, switched: 0, missing: 0 };
  state.wrapper = function (utterance) {
    // Kana, half-width kana, or Han. Han-only Chinese also matches by design.
    if (utterance && /[\u3041-\u3096\u30a1-\u30fa\uff66-\uff9d\u3400-\u4dbf\u4e00-\u9fff]/u.test(utterance.text || '')) {
      const voices = synth.getVoices();
      const japanese = voices.filter(v => /^ja(?:[-_]|$)/i.test(v.lang));
      const voice = japanese.find(v => v.name === state.settings.japaneseVoice)
        || japanese.find(v => /Sayaka/i.test(v.name)) || japanese[0];
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang || 'ja-JP'; state.switched++; }
      else state.missing++;
    }
    return state.original.call(synth, utterance);
  };
  synth.speak = state.wrapper;
  window[key] = state;
  return { installed: synth.speak === state.wrapper };
}
function removeFromRenderer() {
  const key = '__onecommeAutoJapaneseSpeech_v1';
  const state = window[key];
  if (state && window.speechSynthesis.speak === state.wrapper) {
    window.speechSynthesis.speak = state.original;
    delete window[key];
  }
}
const plugin = {
  name: '日本語コメント音声切替',
  uid: 'local.onecomme.auto-japanese-speech',
  version: '1.0.1',
  author: 'orangeqoon',
  url: 'http://localhost:11180/plugins/local.onecomme.auto-japanese-speech/',
  permissions: [],
  defaultState: { japaneseVoice: 'Microsoft Sayaka - Japanese (Japan)' },
  init(api) {
    const { app, BrowserWindow } = require('electron');
    this.api = api;
    this.windows = new Map();
    this.active = true;
    this.settings = { japaneseVoice: api.store.get('japaneseVoice', this.defaultState.japaneseVoice) };
    this.attach = win => {
      if (!this.active || this.windows.has(win.id)) return;
      const wc = win.webContents;
      const inject = async () => {
        if (!this.active || wc.isDestroyed()) return;
        const url = wc.getURL();
        // Only the packaged application's renderer, never embedded streaming sites.
        if (!url.startsWith('file:') || !/\/out\/renderer\//i.test(url)) return;
        try {
          await wc.executeJavaScript(`(${installInRenderer.toString()})(${JSON.stringify(this.settings)})`);
        } catch (err) { this.api.log?.error?.('[AutoJapanese] install failed', String(err)); }
      };
      this.windows.set(win.id, { wc, inject });
      wc.on('did-finish-load', inject);
      wc.once('destroyed', () => this.windows.delete(win.id));
      void inject();
    };
    this.created = (_event, win) => this.attach(win);
    app.on('browser-window-created', this.created);
    BrowserWindow.getAllWindows().forEach(this.attach);
    this.app = app;
  },
  destroy() {
    this.active = false;
    this.app?.removeListener('browser-window-created', this.created);
    for (const { wc, inject } of this.windows?.values() || []) {
      if (wc.isDestroyed()) continue;
      wc.removeListener('did-finish-load', inject);
      void wc.executeJavaScript(`(${removeFromRenderer.toString()})()`).catch(() => {});
    }
    this.windows?.clear();
  },
  async request(req) {
    if (req.method !== 'GET') return { code: 405, response: { error: 'Read only' } };
    const windows = [];
    for (const { wc } of this.windows?.values() || []) {
      if (wc.isDestroyed() || !wc.getURL().startsWith('file:') || !/\/out\/renderer\//i.test(wc.getURL())) continue;
      try {
        windows.push(await wc.executeJavaScript(`(() => {
          const s = window[${JSON.stringify(KEY)}];
          return { installed: !!s, switched: s?.switched || 0, missing: s?.missing || 0,
            voices: window.speechSynthesis.getVoices().filter(v => /^ja(?:[-_]|$)/i.test(v.lang)).map(v => ({name:v.name,lang:v.lang})) };
        })()`));
      } catch (_) { /* A window can close while status is requested. */ }
    }
    return { code: 200, response: { version: this.version, settings: this.settings, windows } };
  }
};
module.exports = plugin;
