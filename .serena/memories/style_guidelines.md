## コーディングスタイル
- Prettier準拠（2スペース、ダブルクォート、セミコロン、importは由来順に並べる）
- Reactの関数コンポーネントを基本とし、PascalCaseのファイル名・コンポーネント名、camelCaseのフック/ユーティリティ、定数はSCREAMING_SNAKE_CASE
- Zustandのstoreとselectorは同ファイルでnamed export、複雑なUIはTailwindユーティリティ優先、必要に応じて`styles/*.css`
- コメントは必要最小限、仕様に関わる箇所のみ補足
- 既存ファイルが日本語を含むため、文書・UIテキストは適宜日本語を使用