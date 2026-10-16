# 日本語コメント音声切替 / Auto Japanese Speech

**配信の枠ごとに声を選び、日本語コメントだけ日本語の声で読む**わんコメ用の非公式プラグインです。

例えば、Twitchの枠は「英語音声＋日本語Haruka」、日本語中心の枠は「Ayumiで統一」といった使い分けができます。同じサイトの複数枠にも対応します。

**[はじめての方はこちら：画像付き導入ガイド](docs/GETTING_STARTED.md)**

[配布ZIPをダウンロード（v1.2.0）](https://github.com/orangeqoon/onecomme-plugin-auto-japanese-speech/releases/download/v1.2.0/auto-japanese-speech-1.2.0.zip) · [Releaseページ](https://github.com/orangeqoon/onecomme-plugin-auto-japanese-speech/releases/tag/v1.2.0)

![ZIPのダウンロードから設定・確認までの6ステップ](docs/images/01-installation.png)

*操作案内図です。わんコメなどの実画面写真ではありません。*

## できること

- わんコメに登録してある枠名を自動取得。接続OFFの枠も設定対象にできます。
- 枠ごとに「通常の声」「日本語の声」を選択。
- 日本語も同じ声で読む設定や、サイト共通の設定を引き継ぐ設定。
- 枠名を変更しても設定を維持。枠一覧は自動で更新。

## 導入の流れ

1. 配布ZIPをダウンロードし、右クリック → **「すべて展開」**。
2. わんコメの右上メニュー → **「プラグイン」→「プラグインフォルダ」**を開く。
3. ZIP内の **`auto-japanese-speech` フォルダ**を、開いた場所へコピー。
4. わんコメで **「再読み込み」→「日本語コメント音声切替」を有効化**。
5. プラグインのURLボタンから設定画面を開き、声を選んで保存。

Node.jsやAPIキー、GitHubアカウントは不要です。最初はわんコメの**内蔵音声エンジン（標準）**で使います。

フォルダの置き方や、音が出ない場合の確認は[画像付き導入ガイド](docs/GETTING_STARTED.md)にまとめています。

## 設定画面の見本

![実際の設定画面を説明用データで表示した見本。枠ごとの設定、通常音声、日本語音声、保存ボタンに番号を付けています](docs/images/03-voice-settings.png)

*枠名・音声一覧は説明用サンプルです。番号を追加し、画面の下部を省略しています。実際にはご自身の枠とPCの音声が表示されます。*

「この枠の設定」を選び、通常の声と日本語の声を選んで「設定を保存」を押します。声はPCで利用できるものから選びます。このプラグインが新しい音声をインストールすることはありません。

## 対応範囲

| 項目 | 内容 |
| --- | --- |
| 調査対象 | Windows / わんコメ9.2.0-beta.0。他の版・OSは未確認 |
| 音声 | わんコメの内蔵音声。利用可能な日本語音声が必要 |
| 外部TTS | わんコメ本体の連携と共存。外部の話者選択は本体で行う |
| 混在する言語 | 日本語を含むコメント全体を日本語音声で読む。漢字だけの中国語も日本語判定 |
| 翻訳 | 翻訳機能ではなく、読む声を切り替える機能 |

旧版の日本語自動切替はユーザー実機確認済みです。v1.2.0の枠別機能は模擬再生・ブラウザUI・登録枠データで検証済みですが、実音声は未確認の試験公開版です。[詳しい検証情報](docs/TECHNICAL.md)

## もっと詳しく

- [画像付き導入ガイド・困ったとき・更新方法](docs/GETTING_STARTED.md)
- [VOICEVOX・AivisSpeech・COEIROINK・棒読みちゃん等の使い方](EXTERNAL_TTS.md)
- [技術仕様・権限・開発・検証情報](docs/TECHNICAL.md)
- [変更履歴](CHANGELOG.md)
- [不具合の報告](https://github.com/orangeqoon/onecomme-plugin-auto-japanese-speech/issues)

## English

Unofficial OneComme plugin for per-frame Web Speech voices and automatic Japanese voice selection. Download the release ZIP, extract it, copy its `auto-japanese-speech` folder into OneComme's plugins folder, reload and enable the plugin. Open the plugin URL to configure voices. Windows / OneComme 9.2.0-beta.0 was inspected; other versions/OS are unverified. No API key or Node.js installation is required for users. External speech engines are configured through OneComme's own integrations. New per-frame playback remains unverified on real audio.

## ライセンス

[MIT License](LICENSE) / Copyright (c) 2026 orangeqoon。わんコメ公式との提携・公式サポートを示すものではありません。わんコメと各音声の利用条件は、それぞれの配布元に従ってください。
