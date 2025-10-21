# Swimlane Studio フロー自動生成プロンプト

以下のプロンプトを生成 AI に渡すことで、Swimlane Studio がそのままインポートできる大規模フローを出力させられます。ワークフローやシステム連携など、任意のドメインに合わせて「### 要件」内の括弧 `<>` を埋めてご利用ください。

---

あなたは業務設計に精通したシニアアナリストです。Next.js 製アプリ「Swimlane Studio」でそのままインポート可能なフロー図データ（Mermaid 記法）を生成してください。以下の仕様を厳守します。

### 出力形式
- 先頭行は必ず ```mermaid で始め、2 行目に `flowchart TD`、3 行目に `%% Swimlane Studio Export v1` を置く
- 続けて `diagram-meta` と `swimlane-json` の JSON を出力すること
  - `diagram-meta` には `id`（ランダムな短い ID 文字列）、`title`、`createdAt`、`updatedAt` を ISO8601 形式で含める
  - `swimlane-json` には `lanes`、`steps`、`connections` を配列で含める
    - `lanes` … `id`、`title`、`description`、`order`、`color`
    - `steps` … `id`、`laneId`、`title`、`description`、`order`、`x`、`y`、`width`、`height`、`color`、`kind`
    - `connections` … `id`、`sourceId`、`targetId`、`sourceHandle`、`targetHandle`、`control`（不要なら null）、`startMarker`、`endMarker`、`markerSize`、`label`
- 以降は通常の Mermaid `subgraph` ブロックでレーン・ステップ・コネクタを定義する
- **最終行は必ず ``` で閉じること**（余計な改行は不要）

### 設計要件
- レーン（Swimlane）は必ず `<レーン数（例: 4）>` 本以上用意し、`order` は 0 から始まる連番にする
- ステップ（Step）は 40〜60 行程度のボリュームで、各レーンにバランスよく配置する
- `kind` は `start` / `process` / `decision` / `file` / `end` を使い分ける
  - `file` ステップにはファイル処理の詳細（例: 「CSV取り込み」）を `description` に記載
- ステップの `width` / `height` / `color` / `title` のフォント色などは **すべてデフォルト値** を使用し、上書きしない（Mermaid `style` での変更も禁止）
- `order` の昇順でステップを並べ、`x` / `y` は 240px グリッドを意識しつつランダム性を持たせる
- `connections` は論理的に整合し、循環ループが必要であれば `control` で折れ曲がり座標を指定する
  - `label` には条件やメモを適宜記入する（不要なら空文字）
- 全ての ID は一意で、人が編集しやすい 16〜22 文字程度のランダム文字列を推奨

### コンテキスト
- 想定業務: `<例: BtoB SaaS 企業の顧客ライフサイクル管理>`
- 主要プロセス: `<例: リード獲得 / 商談化 / 契約 / 導入 / サクセス / 更新>`
- 特記事項: `<例: AI 判定による優先順位付け、複数システム連携、例外ハンドリング>`

### 制約
- 生成するのは **Mermaid 記法のみ**。説明文や余計なコメントは不要
- Mermaid 内の JSON はエスケープを正確に行うこと（ダブルクォート、改行など）
- 40 行以上の `steps` を必ず出力し、`connections` は全ステップを網羅的につなぐ
- レーンごとの `x` 座標は Swimlane に揃うように配置する（デフォルト幅 240px のステップを想定し、`x = 120 + 368 * laneOrder` を基本とすること）。`y` 座標は `120 + 240 * 行番号` のグリッドを守る

---

> 例: デモとして当アプリで利用できる Mermaid 出力
> ```mermaid
> flowchart TD
> %% Swimlane Studio Export v1
> %% diagram-meta:{"id":"demo","title":"Demo","createdAt":"2024-01-01T00:00:00.000Z","updatedAt":"2024-01-01T00:00:00.000Z"}
> %% swimlane-json:{"lanes":[],"steps":[],"connections":[]}
> ```

---

上記テンプレートを基に、プロジェクト固有のレーン名・ステップ名・コネクタ条件を埋め替えてご使用ください。
