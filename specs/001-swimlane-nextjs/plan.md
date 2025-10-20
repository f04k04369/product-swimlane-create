# Implementation Plan: スイムレーン図作成アプリ

**Branch**: `001-swimlane-nextjs` | **Date**: 2024-XX-XX | **Spec**: `specs/001-swimlane-nextjs/spec.md`
**Input**: Feature specificationからの要件およびユーザーストーリー

## Summary

Next.js + TypeScriptのシングルページアプリでスイムレーン図エディタを提供する。ドラッグ＆ドロップでレーン/ステップを整列配置し、Mermaid記法の`.md`およびPNG出力をサポートする。データ永続化は行わず、Mermaidファイルとブラウザ内ストレージで再利用性を担保。操作履歴を監査ログとしてクライアント側で蓄積・ダウンロード可能にする。

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 14 App Router)  
**Primary Dependencies**: Next.js, React Flow (レーン編集 UI), Mermaid.js, Zustand（状態管理）, TailwindCSS（UIスタイル）  
**Storage**: なし（ブラウザLocalStorageのみ任意利用）  
**Testing**: vitest + React Testing Library（後続で整備予定）  
**Target Platform**: Webブラウザ（Chrome/Edge 最新版中心、デスクトップ最適化）  
**Project Type**: Webアプリ（単一プロジェクト、App Router構成）  
**Performance Goals**: 整列処理レスポンス < 500ms、PNG出力 < 3s  
**Constraints**: オフライン利用想定、DB・認証・コラボなし、Mermaid往復で完全再現  
**Scale/Scope**: 単一ユーザー、同時編集なし、編集対象図は数十レーン・数百ステップを想定

## Constitution Check

プロジェクト憲章に明文化された制約は未設定。ローカル専用アプリであるため、テスト整備と監査ログ確保で品質を担保する。

## Project Structure

### Documentation (this feature)

```
specs/001-swimlane-nextjs/
├── plan.md
├── spec.md
├── tasks.md
```

追加で research.md / data-model.md / quickstart.md / contracts/ は現時点で不要。

### Source Code (repository root)

```
app/
├── layout.tsx
├── page.tsx              # エディタ画面
├── api/                  # 画像生成等のRoute Handler（必要なら）
└── (将来) その他ページ

components/
├── canvas/               # React Flowベースのキャンバス関連
├── panels/               # レーン/ステップ編集パネル
├── export/               # エクスポートモーダル
└── ui/                   # 汎用UIコンポーネント

lib/
├── diagram/              # モデル・整列ロジック
├── mermaid/              # Mermaid変換ロジック
├── export/               # PNG/MD出力ヘルパー
└── audit/                # 監査ログ記録処理

state/
└── useDiagramStore.ts    # Zustandストア

styles/
└── globals.css

public/
└── assets/
```

**Structure Decision**: Next.js App Routerベースの単一フロントエンド構成とし、エディタ機能をコンポーネント/ライブラリ単位で分離して保守性を確保する。

## Complexity Tracking

該当なし。
