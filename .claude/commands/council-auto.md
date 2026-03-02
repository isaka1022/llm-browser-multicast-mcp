# /council-auto - 全自動Council議論

ユーザーの質問を全自動の3ステージCouncilパイプラインで処理する。
（意見収集 → 匿名相互レビュー → 議長統合）

## 引数

$ARGUMENTS にユーザーの質問・議論テーマが入っている。

## 動作

`council_discuss` MCPツールを1回呼ぶだけ。

```
council_discuss:
  question: $ARGUMENTS
```

結果がMarkdownで返ってくるので、そのままユーザーに見せる。
