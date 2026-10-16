'use strict';
// Developer-only image renderer. Requires Playwright and Microsoft Edge.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'docs/images');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1050 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const [file, name] of [['installation.html','01-installation.png'], ['folder-layout.html','02-folder-layout.png']]) {
      await page.goto(pathToFileURL(path.join(__dirname, file)).href);
      await page.screenshot({ path: path.join(output, name), fullPage: true });
    }
    const settings = {
      japaneseVoice: 'Microsoft Sayaka - Japanese (Japan)', normalVolume: 80, japaneseVolume: 40, sites: {}, frames: {
        'demo-twitch': { override: true, normalVolume: 80, japaneseVolume: 40, voice: 'English voice (example)', japaneseMode: 'auto', japaneseVoice: 'Microsoft Haruka - Japanese (Japan)' },
        'demo-nico': { override: true, voice: 'Microsoft Ayumi - Japanese (Japan)', japaneseMode: 'site', japaneseVoice: '' }
      }
    };
    const services = [
      { id:'demo-twitch', name:'Twitch 配信（例）', site:'twitch', enabled:true, speech:true, engine:'default' },
      { id:'demo-nico', name:'ニコニコ配信（例）', site:'niconama', enabled:true, speech:true, engine:'default' },
      { id:'demo-fc2', name:'FC2 配信（例）', site:'fc2', enabled:false, speech:true, engine:'default' }
    ];
    const voices = [
      {name:'English voice (example)',lang:'en-US'},
      {name:'Microsoft Sayaka - Japanese (Japan)',lang:'ja-JP'},
      {name:'Microsoft Haruka - Japanese (Japan)',lang:'ja-JP'},
      {name:'Microsoft Ayumi - Japanese (Japan)',lang:'ja-JP'}
    ];
    await page.route('http://127.0.0.1:19384/**', async route => {
      if (route.request().url().includes('/api/plugins/')) {
        if (route.request().method() === 'PUT') Object.assign(settings, route.request().postDataJSON());
        return route.fulfill({json:{code:200,response:{version:'1.3.0',settings,services,windows:[{installed:true,voices}]}}});
      }
      return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8')});
    });
    await page.goto('http://127.0.0.1:19384/');
    await page.getByText('設定を読み込みました',{exact:true}).waitFor();
    assert.equal(await page.locator('#frames tr').count(),3);
    await page.getByRole('button',{name:'設定を保存',exact:true}).click();
    await page.getByText('保存しました。次の読み上げから反映されます。',{exact:true}).waitFor();
    await page.evaluate(() => {
      const banner = document.createElement('div');
      banner.textContent = '設定画面の見本：枠名・音声一覧は説明用サンプルです。実際はご自身のPCの一覧が表示されます。';
      banner.style.cssText = 'background:#e4ebff;color:#284eae;padding:14px 18px;border-radius:9px;font-size:16px;margin-bottom:20px;font-weight:600';
      document.body.prepend(banner);
      const row = document.querySelector('#frames tr');
      for (const [index,text] of [[1,'① この枠で選ぶ'],[2,'② 通常の声'],[4,'③ 日本語の声']]) {
        const cell = row.children[index], label = document.createElement('div');
        label.textContent = text;
        label.style.cssText = 'font-size:14px;font-weight:700;color:#355bd6;margin-bottom:8px';
        cell.prepend(label);
        cell.querySelector('select').style.border='2px solid #355bd6';
      }
      const button = document.querySelector('#save');
      const label=document.createElement('span');label.textContent='④';
      label.style.cssText='display:inline-grid;place-items:center;border:2px solid #355bd6;color:#355bd6;border-radius:50%;width:30px;height:30px;font-size:20px;font-weight:bold';
      button.before(label);
    });
    const bottom = await page.locator('.card').nth(1).boundingBox();
    await page.setViewportSize({width:1400,height:Math.max(1050,Math.ceil(bottom.y+bottom.height+12))});
    await page.screenshot({path:path.join(output,'03-voice-settings.png'),clip:{x:0,y:0,width:1400,height:Math.ceil(bottom.y+bottom.height+12)}});
    assert.deepEqual(errors,[]);
    console.log('Created 3 guide images; settings screenshot uses the real plugin UI with synthetic data and numbered annotations.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
