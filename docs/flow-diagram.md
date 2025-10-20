# フロー図（Swimlane Studio）

## 1. アプリケーション起動フロー
```mermaid
flowchart TD
    A[Next.js ページ描画] --> B[SwimlaneEditor マウント]
    B --> C[useDiagramStore 初期化]
    C --> D{保存済みデータ?}
    D -- いいえ --> E[createEmptyDiagram で初期状態を生成]
    D -- はい --> F[Mermaid/JSON から Diagram を復元]
    E --> G[Canvas とパネルを描画]
    F --> G
    G --> H[ユーザー操作待機]
```

## 2. 編集操作フロー
```mermaid
flowchart LR
    S[ユーザー入力] -->|レーン追加| L[addLane]
    S -->|ステップ追加| T[addStep]
    S -->|ドラッグ操作| M[moveStep / reorderStep]
    S -->|接続操作| C[addConnection / removeConnection]
    S -->|Undo/Redo| U[undo / redo]

    L --> H1[commit: 図を複製し更新]
    T --> H1
    M --> H1
    C --> H1
    U --> H2[undoStack / redoStack を入れ替え]

    H1 --> R[reactflow のノード再描画]
    H1 --> A[監査ログ log]
    H1 --> S1[selection 更新]
    H2 --> R
    H2 --> A
```

ステップの行番号はドラッグまたはパネル入力で更新され、空行は保持される。

## 3. 入出力フロー
```mermaid
flowchart TD
    X[MermaidDialog 開く] --> Y{操作種別}
    Y -- エクスポート --> Z1[exportDiagramToMermaid]
    Y -- インポート --> Z2[ファイル読込]
    Z1 --> Z1b[Mermaid テキスト生成]
    Z1b --> Z1c[クリップボード/ファイルに保存]
    Z2 --> Z2a[Mermaid 解析 → importMermaidDiagram]
    Z2a -->|成功| Z2b[setDiagram で正規化]
    Z2a -->|失敗| Z2c[エラーメッセージ表示]

    X --> P[PNGエクスポート要求]
    P --> P1[exportDiagramToPng]
    P1 --> P2[Blob作成 → ダウンロード]

    X --> Q[監査ログダイアログ]
    Q --> Q1[auditTrail をテーブル表示]
    Q1 --> Q2[JSON生成 → ダウンロード]
```

## 4. ステータス通知フロー
```mermaid
flowchart LR
    Input[入出力・保存系操作] --> Detect[成功/失敗ハンドラ]
    Detect -->|成功| Info[status={type:"info", text}]
    Detect -->|失敗| Error[status={type:"error", text}]
    Info --> Display[通知バー表示]
    Error --> Display
    Display --> Timer[setTimeout 4s]
    Timer --> Clear[status=null]
```

各フロー図は現行実装を基にしており、処理追加・変更時は適宜更新すること。特に編集操作フローはZustandストアのアクション追加やハンドラ分岐が増えた際に差し替える。
