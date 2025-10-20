# クラス図（Swimlane Studio）

以下は主要コンポーネントとドメインモデルの関連を示したクラス図である。

```mermaid
classDiagram
    class SwimlaneEditor {
      +canvasRef
      +handleAddStep(kind)
      +handleExportPng()
    }
    class LanePanel {
      +render()
      +onLaneUpdate()
    }
    class StepPanel {
      +render()
      +onStepUpdate()
      +onConnectionLabelChange()
    }
    class SwimlaneCanvas {
      +render()
      +onNodesChange()
      +onEdgesChange()
      +onConnect()
    }
    class MermaidDialog {
      +open: boolean
      +onImport(file)
      +onExport()
    }
    class AuditLogDialog {
      +open: boolean
      +download()
    }
    class useDiagramStore {
      +diagram: Diagram
      +selection: SelectionState
      +addLane()
      +addStep()
      +undo()/redo()
      +log()
    }
    class Diagram {
      +id: string
      +title: string
      +lanes: Lane[]
      +steps: Step[]
      +connections: Connection[]
    }
    class Lane {
      +id: ElementID
      +title: string
      +order: number
      +color: string
    }
    class Step {
      +id: ElementID
      +laneId: ElementID
      +title: string
      +kind: StepKind
      +x: number
      +y: number
    }
    class Connection {
      +id: ElementID
      +sourceId: ElementID
      +targetId: ElementID
      +label: string
    }
    class exportDiagramToPng {
      +invoke(canvasRef, fileName)
    }
    class exportDiagramToMermaid {
      +invoke(diagram)
    }
    class importMermaidDiagram {
      +parse(mermaidText)
      +toDiagram()
    }

    SwimlaneEditor --> LanePanel : 表示制御
    SwimlaneEditor --> StepPanel : 表示制御
    SwimlaneEditor --> SwimlaneCanvas : キャンバス描画
    SwimlaneEditor --> MermaidDialog : モーダル操作
    SwimlaneEditor --> AuditLogDialog : モーダル操作
    SwimlaneEditor --> useDiagramStore : 状態読み書き
    SwimlaneCanvas --> useDiagramStore : ノード/エッジ同期
    LanePanel --> useDiagramStore : レーン更新
    StepPanel --> useDiagramStore : ステップ更新
    MermaidDialog --> useDiagramStore : 図データ入出力
    MermaidDialog --> exportDiagramToMermaid : 文字列化
    MermaidDialog --> importMermaidDiagram : パース
    AuditLogDialog --> useDiagramStore : ログ参照
    SwimlaneEditor --> exportDiagramToPng : PNG出力
    useDiagramStore --> Diagram : 管理対象
    Diagram --> Lane
    Diagram --> Step
    Diagram --> Connection
    Step --> "1" Lane : laneId
    Connection --> "1" Step : sourceId
    Connection --> "1" Step : targetId
```

## 補足
- `useDiagramStore` はZustandのカスタムフックであり、Reactコンポーネントはそれを介して状態とアクションを利用する。
- `importMermaidDiagram` は `lib/mermaid/import.ts` のユーティリティ群をまとめた概念表現で、Mermaidコードから`Diagram`型へ正規化する。
- `exportDiagramToPng` はDOM参照を受け取り、`html-to-image` 経由でPNGファイルを生成する。
- UIレイヤー（SwimlaneEditor, LanePanel, StepPanel, SwimlaneCanvas, MermaidDialog, AuditLogDialog）とユーティリティ層（`export*`, `import*`）の依存方向を矢線で示している。
- TypeScriptの型（`Diagram`, `Lane`, `Step`, `Connection`）は `lib/diagram/types.ts` で定義され、全層から参照される。
- `Step.order` は「行番号（0始まり）」として扱われ、レイアウト時にセル状グリッドへスナップされる。

本図は実装の大枠を表現したものであり、詳細な内部関数は省略している。変更を加えた場合は依存関係の影響範囲を確認し、本図を更新すること。
