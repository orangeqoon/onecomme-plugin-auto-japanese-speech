# 日本語コメント音声切替 / Auto Japanese Speech

わんコメ（OneComme）の標準読み上げで、日本語を含むコメントだけ日本語音声に切り替える非公式プラグインです。英語などのコメントは、わんコメで選択している音声で読みます。

従来の日本語自動切替はユーザーによる実機動作確認済みです。**v1.2.0の枠別音声設定は、模擬音声APIとブラウザUIで検証済みですが実音声は未確認です。**わんコメの内部実装に依存するため、すべてのバージョンでの動作を保証するものではありません。

## ダウンロード・導入

1. [Releases](https://github.com/orangeqoon/onecomme-plugin-auto-japanese-speech/releases) から `auto-japanese-speech-1.2.0.zip` をダウンロードして展開します。
2. わんコメ右上メニュー →「プラグイン」→「プラグインフォルダ」を開きます。
3. 展開した `auto-japanese-speech` フォルダを配置します。`plugins/auto-japanese-speech/plugin.js` となるようにしてください。
4. プラグイン画面で「再読み込み」→「日本語コメント音声切替」を有効にします。
5. 読み上げエンジンを「標準」にし、普段の英語・他言語の音声を選びます。
6. コメントテスターで `Hello, welcome!` → `こんにちは、テストです` → `Hello again` を順に確認します。

APIキー・外部TTSサーバー・追加npmパッケージは不要です。わんコメで使用可能な日本語音声が必要です。Microsoft Sayakaを優先し、なければ利用可能な日本語音声を使います。

## 枠名ごとの設定（v1.2.0）

設定画面は、わんコメに登録されている全枠を自動取得します。接続OFF・読み上げOFFの枠や、既定のサイト一覧にない枠も含みます。

1. 枠の行で「この枠の設定」を選びます。
2. 「通常の声」「日本語コメントの扱い」「日本語の声」を設定します。
3. 「設定を保存」を押します。

同じサイトの複数枠や同名の枠も、枠IDで区別します。枠名を変更しても設定は維持されます。枠を削除して作り直すと別のIDになり、自動で設定を転用しません。

枠の個別設定 → サイト別設定 → わんコメ本体の音声の順で使います。「サイト設定を引き継ぐ」は従来のサイト別設定を使用します。個別設定内の空の「通常の声」は、サイトの声ではなく本体の声を維持します。日本語用の声が空の場合は共通日本語音声に従います。

一覧は10秒ごとに自動更新され、編集中の音声選択は保持します。削除済み枠の設定は保存データに残し、ほかの枠に誤適用しません。この画面では接続・読み上げのON/OFFは変更しません。

外部エンジンを設定している枠はエンジン名を表示し、内蔵音声用の選択欄を無効にします。外部TTSの割り当ては、わんコメ本体の「連携」と各枠の「… → 設定」で行います。[外部TTSの使い方と拡張案](EXTERNAL_TTS.md)を参照してください。

権限は `filter.speech`・`services`・`config` です。`config` は既定エンジンの名前だけを読み取り、診断には設定全体や認証情報を含めません。枠一覧もID・名前・サイト種別・ON/OFF・エンジン名だけを返し、配信URLやログイン情報は返しません。

## サイトごとの共通設定

プラグイン一覧のURLボタンから設定画面を開きます。

| 項目 | 動作 |
| --- | --- |
| 通常の声 | そのサイトの読み上げ音声。空欄はわんコメ本体の設定を維持 |
| 日本語コメント: 日本語の声に切り替える | 日本語検出時、そのサイトの日本語音声へ切り替え |
| 日本語の声 | 未指定なら共通の日本語音声を使用 |
| 日本語コメント: 同じ声を使う | 日本語も通常の声で読み上げ。日本語中心のサイト向け |

ニコニコ、FC2、Twitch、Kick、ツイキャス、YouTube、その他に対応します。例: Twitchは通常を英語音声・日本語をHaruka、FC2は通常をIchiroとして「同じ声を使う」など。

「設定を保存」を押すと永続化し、次の読み上げから反映します。音声のリストは利用中のわんコメから取得します。見つからない通常音声は本体設定へ、日本語音声は共通音声・利用可能な日本語音声へフォールバックします。

一般のコメントテスターとサイト情報のない直接読み上げは「その他」です。サイトごとの確認は各サイトからのコメントで行ってください。表示コメントは加工しません。内部の `speechText` にはサイトと枠IDの識別マーカーが付き、Web Speech呼び出し直前に除去します。他の読み上げ文字列加工プラグインがマーカーを書き換えると正しく判定できない場合があります。

外部エンジンは今回追加していません。外部エンジンが指定された読み上げは、サイト設定および標準音声用マーカーの対象外です。未知のサイト種別は「その他」になります。既定の日本語判定（漢字を含む）も引き継ぎます。

更新時はプラグインを無効化し、`plugin.js` と `index.html` を上書きした後に再読み込み・有効化してください。`state.json` は残してください。現在は `filter.speech`・`services`・`config` を使用します。

## 対応範囲

- 調査対象: Windows / OneComme 9.2.0-beta.0。ほかの版とmacOS/Linuxは未確認です。
- 標準のWeb Speech読み上げが対象です。SAPI5、VOICEVOX、棒読みちゃん等の外部エンジンには適用されません。
- 日英混在コメントは全体を日本語音声で読みます。言語ごとの文分割はしません。
- ひらがな・カタカナ・半角カナ・漢字を検出します。漢字だけの中国語も日本語判定になります。
- 既存の音量・速度と、わんコメ側の読み上げ制御を引き継ぐ設計です。辞書等で加工されたテキストが判定対象です。

## 状態確認・停止

プラグイン一覧のURLボタンで診断ページを開けます。`installed: true`、`voices` に日本語音声、日本語発話後に `switched` が増えるのが目安です。`missing` が増える場合は利用可能な日本語音声がありません。

`windows` が空の場合、対象のアプリ画面を取得できていません。読み上げ画面を開いた状態でプラグインを無効化→有効化し、状態を再確認してください。

無効化すると元の読み上げ関数へ復元します。削除時は無効化してからプラグインフォルダを削除してください。更新時は無効化して配布ファイルを置き換え、再読み込み・有効化します。利用中の `state.json` は残してください。

## 実装とプライバシー

通常コメントの `filterSpeech` では変更した音声設定が再生側へ引き継がれない構造だったため、Electronのわんコメ自身の `file:` rendererに限定して、Web Speechの再生直前に音声を選ぶラッパーを設定します。公式に保証された音声切替APIではありません。アプリ本体のファイルは変更しません。

このプラグインはコメントを外部へ送信せず、発話ログを保存しません。実際の音声エンジンの通信動作は利用する音声に依存します。設定はわんコメ管理の `state.json`、発話カウンタはメモリ上に保持します。

## 開発・検証

Node.js 22で、リポジトリのルートから実行します。依存パッケージのインストールは不要です。

```powershell
npm run check
npm test
```

模擬APIで言語判定・サイトごとの同一文章の連続再生・日本語音声の優先順位・外部エンジン除外・設定保存と再起動・保存失敗・不正設定・無効化時の復元を確認します。実音声の確認とは別のテストです。

不具合は [Issues](https://github.com/orangeqoon/onecomme-plugin-auto-japanese-speech/issues) に、OS・わんコメ版・選択音声・診断結果を添えて報告してください。コメント本文や個人情報の掲載は不要です。

## 検証状況

旧版の日本語自動切替はユーザーが実機動作確認済み。v1.2.0は同名別枠・改名・並び替え・枠追加・削除後の設定保持・継承・設定保存/再起動・外部エンジン除外・診断からのURL除去を模擬テストで確認しています。設定画面もヘッドレスブラウザで保存・自動更新・改名・未保存選択保持・HTML文字列表示を確認しています。枠別の実音声・外部エンジンでの実音声は未確認です。

## English

Experimental unofficial OneComme plugin: comments containing Japanese characters use an available Japanese Web Speech voice; other comments keep the selected voice. Download the release ZIP, place its `auto-japanese-speech` folder in OneComme's plugins folder, reload and enable it. Use the default speech engine. Windows / OneComme 9.2.0-beta.0 was inspected; the original Japanese switching was user-verified, while the new per-site feature still needs real playback verification. Mixed-language comments and Han-only Chinese use the Japanese voice. External engines are unsupported. No API key or npm dependencies required.

## ライセンス・資料

MIT License / Copyright (c) 2026 orangeqoon. わんコメ公式との提携・公式サポートを示すものではありません。

- [わんコメ公式プラグイン仕様](https://onecomme.com/docs/developer/plugin/)
- [わんコメ公式プラグイン導入手順](https://onecomme.com/docs/feature/plugins/)

Version 1.1.0 adds per-site normal/Japanese voice selectors, persistent settings and automatic fallback. Open the plugin URL to configure Niconico, FC2, Twitch, Kick, TwitCasting, YouTube and other sources.

Version 1.2.0 discovers all registered OneComme frames and stores per-frame rules by stable ID. Rename-safe settings, disabled-frame visibility and periodic discovery are supported. External engines continue to use OneComme's native integrations; see EXTERNAL_TTS.md.
