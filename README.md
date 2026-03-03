# LLM Council

複数 LLM による議論を実行する MCP サーバー。

## アーキテクチャ

```
MCP Client (Claude Code 等)
    ↓ MCP tools
src/index.ts
    ↓
src/orchestrator/   council / roundtable / debate
    ↓
src/providers/      CLI (gemini/claude/codex) | API (Gemini/Grok/Anthropic) | Playwright (ChatGPT)
    ↓
logs/sessions/      JSONL イベントログ
    ↓
src/viewer/server.ts  http://localhost:3737 で可視化
```

## プロバイダー

| 種別 | 設定 type | 備考 |
|------|-----------|------|
| gemini-cli | `gemini-cli` | `gemini` コマンド必要 |
| claude-cli | `claude-cli` | `claude` コマンド必要 |
| codex-cli | `codex-cli` | `codex` コマンド必要 |
| Gemini API | `gemini-api` | `GEMINI_API_KEY` 必要 |
| Grok API | `grok-api` | `XAI_API_KEY` 必要 |
| Anthropic API | `anthropic` | `ANTHROPIC_API_KEY` 必要 |
## スクリプト

```bash
npm run build   # TypeScript ビルド
npm run dev     # MCP サーバー（開発用 tsx）
npm run start   # MCP サーバー（本番）
npm run viewer  # タイムラインビューアー http://localhost:3737
```
