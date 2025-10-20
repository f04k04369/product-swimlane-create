---
description: "Implementation tasks for swimlane editor MVP"
---

# Tasks: スイムレーン図作成アプリ

**Input**: `/specs/001-swimlane-nextjs/spec.md`, `/specs/001-swimlane-nextjs/plan.md`  
**Prerequisites**: Next.jsプロジェクト雛形、Mermaid仕様確認、UIワイヤーフレーム  
**Tests**: 手動E2E検証を中心とし、必要に応じてvitestの単体テストを追加

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 並列実行可能なタスク
- **[Story]**: 対応ユーザーストーリー（US1, US2, US3）

---

## Phase 1: プロジェクトセットアップ (Shared Infrastructure)

- [ ] T001 [P] [US1] Next.js 14 + TypeScript + TailwindCSS 初期化 (`package.json`, `app/` 構成)
- [ ] T002 [P] [US1] Zustand・React Flow・Mermaid.js・html-to-image依存導入と設定
- [ ] T003 [US1] ベースレイアウト (`app/layout.tsx`, `styles/globals.css`) とUIトークン定義

---

## Phase 2: キャンバス基盤 (User Story 1)

- [ ] T010 [US1] 図モデルと型定義 (`lib/diagram/`) および初期状態管理 (`state/useDiagramStore.ts`)
- [ ] T011 [P] [US1] Drag-and-dropキャンバス実装 (`components/canvas/`) とグリッドスナップ整列ロジック
- [ ] T012 [P] [US1] レーン/ステップ編集パネルとプロパティ編集UI (`components/panels/`)
- [ ] T013 [US1] Undo/Redoとブラウザストレージ自動保存オプション実装
- [ ] T014 [US1] エディタ画面統合 (`app/page.tsx`) とプレビュー表示

---

## Phase 3: Mermaid往復 (User Story 2)

- [ ] T020 [US2] Mermaidエクスポート変換ロジック (`lib/mermaid/export.ts`) と`.md`ダウンロード
- [ ] T021 [US2] Mermaidインポートパーサ (`lib/mermaid/import.ts`) とエラー表示UI (`components/export/ImportDialog.tsx`)
- [ ] T022 [US2] エクスポート/インポートモーダル統合、インポート検証フロー

---

## Phase 4: PNGエクスポート (User Story 3)

- [ ] T030 [US3] PNG生成ヘルパー (`lib/export/png.ts`) とDPI調整
- [ ] T031 [US3] PNGエクスポートUI (`components/export/PngDialog.tsx`)
- [ ] T032 [US3] PNG品質確認の手動テストシナリオ策定

---

## Phase 5: 監査ログ & 仕上げ (Cross-Cutting)

- [ ] T040 [US1] 操作イベント監査ログ収集 (`lib/audit/logger.ts`) とダウンロード機構
- [ ] T041 [P] [US1] エラーハンドリング・離脱警告・入力バリデーション整備
- [ ] T042 [US1] 手動E2E検証チェックリスト作成と回帰テスト手順書更新
- [ ] T043 [P] [US1] 最終ドキュメント更新（README、使用手順）

---

## Dependencies & Execution Order

- Phase 1完了後にキャンバス基盤（Phase 2）へ進む。
- Mermaid往復（Phase 3）はキャンバス基盤完成が前提。
- PNGエクスポート（Phase 4）はキャンバス描画安定化後に実施。
- 監査ログと仕上げ（Phase 5）は全フェーズの横断タスクとして最後にまとめる。
