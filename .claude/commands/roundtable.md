# /roundtable - ラウンドテーブル議論

ユーザーの質問をラウンドテーブル形式で議論する。
各モデルが順番に発言し、前の発言を踏まえて議論を深める。

## 引数

$ARGUMENTS にユーザーの質問・議論テーマが入っている。

## 動作

`roundtable_discuss` MCPツールを呼ぶ。

```
roundtable_discuss:
  question: $ARGUMENTS
  rounds: 2
```

結果がMarkdownで返ってくるので、そのままユーザーに見せる。
