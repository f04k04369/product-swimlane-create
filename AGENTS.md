# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js entry points (`layout.tsx`, `page.tsx`) and global styling.
- `components/`: Reusable React components with Tailwind utility classes.
- `state/`: Zustand stores and selectors governing editor state.
- `lib/`: Helpers for Mermaid export, auditing, and shared utilities.
- `styles/` & `app/globals.css`: Tailwind layers and custom design tokens.
- `public/`: Static assets bundled with builds.
- `tests/`: Vitest suites (`*.test.ts`) plus Playwright specs under `tests/e2e/`.
- `specs/`: Reference Mermaid exports for manual regression checks.

## Build, Test, and Development Commands
- `npm run dev`: Start the Next.js dev server on `http://localhost:3000` with hot reload.
- `npm run build`: Produce the optimized production bundle and type-check code.
- `npm run start`: Serve the built app locally for smoke tests.
- `npm run lint`: Run ESLint using the Next.js configuration.
- `npm run format`: Check formatting against the repository Prettier rules.
- `npm run test`: Run Vitest suites in Node + JSDOM.
- `npm run test:e2e`: Execute Playwright end-to-end scenarios; the server boots automatically.

## Coding Style & Naming Conventions
- Follow Prettier defaults (2 spaces, semicolons, double quotes) and group imports by origin.
- Use PascalCase for components and file names, camelCase for utilities and hooks, reserving SCREAMING_SNAKE_CASE for constants.
- Export Zustand selectors alongside store definitions and prefer named exports.
- Prefer function components, React hooks, and Tailwind utilities; move complex CSS into `styles/*.css` when needed.

## Testing Guidelines
- Keep unit or integration suites in `tests/` and name files `*.test.ts(x)`.
- Use Testing Library matchers for DOM assertions and stub Zustand state with local helpers.
- Store Playwright specs in `tests/e2e/`, limiting each to a focused user flow (lane creation, Mermaid export, etc.).
- Before opening a PR, run `npm run test` and `npm run test:e2e`; refresh `specs/` artifacts when workflows change.

## Commit & Pull Request Guidelines
- History uses concise imperative messages (e.g., "Initial commit"); follow that voice and add prefixes like `feat:` or `fix:` when helpful.
- Reference related issues and highlight user-facing impact in the message body.
- PRs should outline the problem, solution, and validation steps, attaching screenshots or Mermaid diffs for UI changes.
- State which linting and test commands ran so reviewers can reproduce quickly.

## setings
- 回答などは全て日本語でお願いします。
- テストの実行はループしないように1度エラーを起こして改修項目が出た場合は再実行の確認を都度とること。