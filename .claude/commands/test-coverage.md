---
allowed-tools: Bash(npm run test:coverage:*)
description: カバレッジを計測して改善箇所を提案する
---

## カバレッジ計測
!`npm run test:coverage 2>&1`

上記のカバレッジレポートを分析してください。
1. カバレッジが低いファイルと行を特定する
2. 優先度の高い順に追加テストを提案する
3. カバレッジ閾値（lines: 70%）を下回っている場合は警告を出す
