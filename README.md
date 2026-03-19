# llm-council-mcp

複数の AI モデル (ChatGPT, Gemini, Claude, Grok) をブラウザ自動操作で同時に活用し、議論・討論・合議を行う MCP サーバー。

## Features

- **Council** — 全モデルが並列回答 → 匿名相互レビュー → 議長が最良回答を統合
- **Roundtable** — モデルが順番に発言し、前の発言を踏まえて議論を深める
- **Debate** — 立場表明 → ラウンド制討論 → 最終立場 → 議長が合意点・相違点を整理
- **Ask Model / Ask Models** — 単一 or 複数モデルへの直接質問（対話的に使用）
- **Deep Research** — ChatGPT Deep Research モードによる深堀り調査
- **Timeline Viewer** — セッションログの可視化 (`llm-council-viewer`)

## Installation

```bash
npm install -g llm-council-mcp

# Chromium ブラウザのインストール（必須）
npx playwright install chromium
```

## Quick Start

### 1. MCP クライアントに登録

Claude Code の場合:

```json
{
  "mcpServers": {
    "llm-council": {
      "command": "npx",
      "args": ["-y", "llm-council-mcp"]
    }
  }
}
```

### 2. ブラウザログイン（初回のみ）

各 AI サービスへのログインが必要です。初回は `headless: false` で起動し、ブラウザ上で手動ログインします。ログイン状態は `~/.llm-council/` に保存されます。

設定ファイルで `"headless": false` を指定してサーバーを起動し、表示されるブラウザで各サービスにログインしてください。

### 3. 設定ファイル

`council.config.json` を作成（場所は下記の順に検索）:

1. `$COUNCIL_CONFIG` 環境変数で指定したパス
2. カレントディレクトリの `council.config.json`
3. `~/.config/llm-council/config.json`

設定なしでもデフォルト（ChatGPT, Gemini, Claude, Grok の Web UI）で動作します。

```json
{
  "providers": {
    "chatgpt": { "type": "chatgpt-web", "models": ["gpt-4o"] },
    "gemini": { "type": "gemini-web", "models": ["gemini-2.5-pro"] },
    "claude": { "type": "claude-web", "models": ["claude-sonnet-4"] },
    "grok": { "type": "grok-web", "models": ["grok-3"] }
  },
  "defaultModels": [
    "chatgpt/gpt-4o",
    "gemini/gemini-2.5-pro",
    "claude/claude-sonnet-4"
  ],
  "chairman": "claude/claude-sonnet-4",
  "timeoutMs": 300000
}
```

### Provider Config

| フィールド | 説明 |
|-----------|------|
| `type` | `chatgpt-web`, `gemini-web`, `claude-web`, `grok-web` |
| `models` | そのプロバイダで使用するモデル名の配列 |
| `service` | ブラウザで操作するサービス（通常は type から自動判定） |
| `profileDir` | ブラウザプロファイルの保存先（省略時はデフォルト） |
| `headless` | `false` にするとブラウザ画面を表示（デバッグ・初回ログイン用） |

## Available MCP Tools

| ツール | 説明 |
|--------|------|
| `council_discuss` | 合議: 並列回答 → 相互レビュー → 議長統合 |
| `roundtable_discuss` | 円卓: 順番に発言し議論を深める |
| `debate_discuss` | 討論: 立場表明 → ラウンド制 → 議長まとめ |
| `list_models` | 利用可能なモデル一覧 |
| `ask_model` | 単一モデルに質問 |
| `ask_models` | 複数モデルに並列質問 |
| `deep_research` | ChatGPT Deep Research（5-30分） |

## Troubleshooting

### ブラウザが起動しない / ログインできない

```bash
# Chromium を再インストール
npx playwright install chromium

# headless: false で設定し、手動でログイン
```

### セレクタエラーが出る

Web UI の DOM 構造が変更された可能性があります。パッケージを最新版にアップデートしてください:

```bash
npm update -g llm-council-mcp
```

### タイムアウトする

デフォルトは 5 分（300,000ms）です。長い議論が必要な場合は `timeoutMs` を増やしてください。

### 並列実行が不安定

同一サービスへの並列リクエストはブラウザタブの管理に依存します。安定しない場合は `defaultModels` を異なるサービスの組み合わせにしてください。

## Security

- `.playwright-auth/` にブラウザセッション（ログイン情報）が保存されます。**絶対に git commit や他者との共有をしないでください**
- `council.config.json` を公開リポジトリに含めないよう `.gitignore` に追加することを推奨します

## Disclaimer

本ソフトウェアは、個人の生産性向上を目的とした実験的ツールです。

本ツールはブラウザ自動操作により各 AI サービスの Web UI を利用します。これは各サービスの利用規約に抵触する可能性があります。**各サービスの利用規約を遵守する責任はユーザーにあります。**

- 大規模な自動化や商用利用は推奨しません
- 本ソフトウェアの使用により生じた損害について、作者は一切の責任を負いません
- 各サービスの利用規約は変更される可能性があります。最新の規約を確認してください

## License

MIT
