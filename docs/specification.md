# 機能仕様書（Swimlane Studio）

## 1. 画面構成
### 1.1 ヘッダー
- タイトル、説明文、主要アクションボタン群を表示する。
- ボタン構成: レーン追加、ステップ追加（5種）、Undo/Redo/リセット、Mermaid入出力、PNGエクスポート、監査ログ、パネル表示切替。
- ボタン活性条件: 対象レーン未選択時はステップ追加ボタンを非活性。

### 1.2 ステータスバー
- 直近アクションの成功/失敗を表示し、4秒後に自動で非表示。
- 種別: info（緑系）、error（赤系）。

### 1.3 メインエリア
- 左: レーン一覧パネル（`LanePanel`）。レーン名・説明・色を編集、並び順変更。
- 中央: スイムレーンキャンバス（`SwimlaneCanvas` + React Flow）。ノード・エッジのドラッグ、選択、接続を提供。
- 右: ステップ詳細パネル（`StepPanel`）。選択中ステップの属性編集と削除操作を提供。
- パネルは個別に開閉可能。
- キャンバス上のコネクタは直角（Step Edge）スタイルで描画され、終点には矢印を描画する。

### 1.4 モーダル
- `MermaidDialog`: インポート/エクスポート、Mermaidコード表示、ファイル入出力、バリデーションメッセージ。
- `AuditLogDialog`: 監査ログ一覧とJSONダウンロードボタン。

## 2. データモデル
| エンティティ | 主フィールド | 説明 |
| --- | --- | --- |
| Diagram | `id`, `title`, `lanes`, `steps`, `connections`, `createdAt`, `updatedAt` | 編集対象のスイムレーン全体。 |
| Lane | `id`, `title`, `order`, `color`, `description` | 縦カラム。`order` の昇順で描画。 |
| Step | `id`, `laneId`, `title`, `order`, `x`, `y`, `width`, `height`, `color`, `kind` | レーン内の処理。`order` は行番号（0始まり）として扱い、座標は自動整列。 |
| Connection | `id`, `sourceId`, `targetId`, `label` | ステップ間接続。条件分岐に `yes`/`no` ラベルを付与。 |
| SelectionState | `lanes`, `steps`, `connections` | UI上の選択状態。 |
| AuditEntry | `id`, `action`, `targetType`, `targetId`, `payload`, `timestamp` | 監査ログの1レコード。 |

## 3. 状態管理
- グローバルストア: `useDiagramStore`（Zustand）。
- コミット関数で履歴スタック・監査ログ・最終更新時刻を一括更新。
- 主なアクション:
  - `addLane(title?)`: 新規レーン作成、デフォルト色割当、選択更新。
  - `updateLane(id, updates)`: タイトル・説明・順序・色を変更。順序変更時は他レーンもリナンバリング。
  - `addStep(laneId, { kind })`: ステップ生成、`deriveStepX` と `yForRow` で配置。
  - `moveStep`/`reorderStep`: ドラッグorボタン操作に応じて順序・座標を再計算。
  - `changeStepKind(id, kind)`: サイズ・色を `KIND_DIMENSIONS` と `KIND_COLORS` に合わせて更新。
  - `addConnection`/`removeConnection`/`updateConnectionLabel`: React Flowのエッジ操作を反映。
  - `undo`/`redo`: `undoStack` と `redoStack` を用い、最大50履歴を保持。
  - `reset`: 初期状態の空ダイアグラムを再生成。
  - `log(entry)`: 監査ログ追記。`setDiagram` など一部操作で自動呼び出し。

## 4. 操作仕様
### 4.1 レーン操作
- ユーザーが「レーンを追加」を押すと、新規レーン（タイトル:「新しいレーン」）が末尾に追加され選択状態になる。
- レーン色は `getLaneColor(order)` に基づき自動配色。順序変更時は色も再計算される。
- レーン削除時は所属ステップと接続を一括で除去し、選択状態をクリアする。

### 4.2 ステップ操作
- 追加直後のステップは選択状態になり、詳細パネルで編集可能。
- ステップのドラッグ時、`rowIndexFromY` と `resolveLaneIndex` により位置を算出。
- ステップ削除時は関連接続が削除され、監査ログに記録される。
- 行番号は`StepPanel`の数値入力で直接更新でき、未使用の行は空白セルとして保持される。
- レーンの高さは保持している行数に応じて自動で拡張される。
- ドラッグ＆ドロップや上下移動操作を行うと、行番号が詰められ連番になる。
- 「上へ移動」「下へ移動」ボタンは、隣の行にステップが存在する場合は入れ替え、空行の場合はその行へ移動する。

### 4.3 接続操作
- React Flowの`onConnect`で接続作成、`onEdgesChange`で削除・更新を検出しストアへ反映。
- ラベル編集はStep Panelで実施し、`updateConnectionLabel`が呼ばれる。
- すべてのステップに左右の入出力ハンドルを配置し、開始/終了などステップ種別に応じて入出力可否だけを制御する。
- コネクタは直角エッジを基本とし、完全に水平/垂直に揃った場合は直線として描画、その他はカギ線で描画する。終端には矢印マーカーを描画する。
- コネクタ中央には制御点を表示し、ドラッグ操作で折れ曲がり位置を変更できる。制御点をリセットするとデフォルトレイアウトへ戻る。
- 開始点・終点のマーカー種別（なし／矢印／ドット）およびサイズは接続編集パネルから任意に調整できる。
- 接続ラベルは50文字以内で任意のテキスト（改行可）を入力でき、既定のクイックボタン（なし／yes／no）からの設定も可能。
- 接続元・接続先ステップは編集パネルから再指定でき、必要に応じて方向を反転できる。
- Mermaidエクスポートではステップの行番号・座標・サイズ・色、コネクタの制御点やマーカー設定をメタデータとして保持し、アプリ専用の拡張メタデータを通じて再インポート時にグラフィカルな状態を忠実に復元する。

### 4.4 Undo / Redo
- 各コミットで `undoStack` にスナップショット（図・ラベル・タイムスタンプ）を保存。
- Undo実行時は現状態をredoStackへ積み、Undo → Redoで往復可能。

## 5. 入出力仕様
### 5.1 Mermaid
- 形式: `flowchart LR`。レーンはサブグラフ、ステップはノード。メタコメントでバージョンとJSONメタデータを付与。
- インポート時:
  1. ファイル読み込み→Mermaidパーサ→JSONメタデータ抽出。
  2. `setDiagram`により正規化し、レーン順序とステップ座標を再計算。
  3. エラー時はユーザー通知し、状態は変更しない。

### 5.2 PNG
- `exportDiagramToPng(canvasRef, fileName)` を介し、`html-to-image` でDOMを画像化。
- 出力ファイル名は図のタイトルまたは `swimlane.png`。

### 5.3 監査ログ
- JSON構造: `[{ id, timestamp, action, targetType, targetId, payload }]`。
- `AuditLogDialog` でテーブル表示し、ボタン押下で`URL.createObjectURL`を用いたダウンロードを行う。

## 6. 通知・バリデーション
- 成功/エラー文言は`status`ステートで管理し、Mermaid/PNG/Audit操作から設定。
- バリデーション例: Mermaidインポート失敗、PNG変換エラー、監査ログ取得失敗。

## 7. アクセシビリティと国際化
- ボタンはTailwindの`Button`コンポーネントを利用し、フォーカスリングを保持。
- UIテキストは日本語で統一し、将来的なi18n対応に備えコンポーネント側で集中管理。

## 8. ドキュメント・メンテナンス
- 新機能追加時は本仕様書の該当セクションを更新し、仕様変更履歴を記録する。
- `docs/` 配下ドキュメントはPull Requestごとに差分確認を行う。
