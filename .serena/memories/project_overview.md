## プロジェクト概要
- Swimlane Studio: Next.js + TypeScript 製のスイムレーン図エディタ
- 主機能: レーン/ステップのドラッグ&ドロップ編集、Mermaid記法・PNG・監査ログのエクスポート、Undo/Redo
- 主要技術: Next.js 14, React 18, Zustand, React Flow, Tailwind CSS, Mermaid, html-to-image
- ディレクトリ: `app/` (Next.js エントリ), `components/` (UI/機能コンポーネント), `state/` (Zustand stores), `lib/` (図形計算・エクスポートヘルパ), `tests/` (Vitest/Playwright), `specs/` (Mermaid出力サンプル)
- ビルド/実行: `npm run dev` で開発サーバ、`npm run build` で本番ビルド