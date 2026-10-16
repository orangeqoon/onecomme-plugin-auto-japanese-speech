# 日本語コメント音声切替 / Auto Japanese Speech

わんコメ（OneComme）の標準読み上げで、日本語を含むコメントだけ日本語音声に切り替える非公式プラグインです。英語などのコメントは、わんコメで選択している音声で読みます。

**試験公開版です。実機でのプラグイン有効化・実音声の確認は未実施です。** 模擬音声APIでのテストは通っています。わんコメの内部実装に依存するため、すべてのバージョンでの動作を保証するものではありません。

## ダウンロード・導入

1. [Releases](https://github.com/orangeqoon/onecomme-plugin-auto-japanese-speech/releases) から `auto-japanese-speech-1.0.1.zip` をダウンロードして展開します。
2. わんコメ右上メニュー →「プラグイン」→「プラグインフォルダ」を開きます。
3. 展開した `auto-japanese-speech` フォルダを配置します。`plugins/auto-japanese-speech/plugin.js` となるようにしてください。
4. プラグイン画面で「再読み込み」→「日本語コメント音声切替」を有効にします。
5. 読み上げエンジンを「標準」にし、普段の英語・他言語の音声を選びます。
6. コメントテスターで `Hello, welcome!` → `こんにちは、テストです` → `Hello again` を順に確認します。

APIキー・外部TTSサーバー・追加npmパッケージは不要です。わんコメで使用可能な日本語音声が必要です。Microsoft Sayakaを優先し、なければ利用可能な日本語音声を使います。

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

模擬APIの10発話で日本語・半角カナ・混在文・英語・他言語・日本語音声なし・重複適用・復元・音量速度維持を確認します。実音声の確認とは別のテストです。

不具合は [Issues](https://github.com/orangeqoon/onecomme-plugin-auto-japanese-speech/issues) に、OS・わんコメ版・選択音声・診断結果を添えて報告してください。コメント本文や個人情報の掲載は不要です。

## English

Experimental unofficial OneComme plugin: comments containing Japanese characters use an available Japanese Web Speech voice; other comments keep the selected voice. Download the release ZIP, place its `auto-japanese-speech` folder in OneComme's plugins folder, reload and enable it. Use the default speech engine. Windows / OneComme 9.2.0-beta.0 was inspected; real playback remains unverified. Mixed-language comments and Han-only Chinese use the Japanese voice. External engines are unsupported. No API key or npm dependencies required.

## ライセンス・資料

MIT License / Copyright (c) 2026 orangeqoon. わんコメ公式との提携・公式サポートを示すものではありません。

- [わんコメ公式プラグイン仕様](https://onecomme.com/docs/developer/plugin/)
- [わんコメ公式プラグイン導入手順](https://onecomme.com/docs/feature/plugins/)
