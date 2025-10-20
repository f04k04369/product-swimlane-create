import { describe, expect, it } from 'vitest';
import { exportDiagramToMermaid } from '@/lib/mermaid/export';
import { importMermaidToDiagram } from '@/lib/mermaid/import';
import { createEmptyDiagram } from '@/lib/diagram/defaults';

describe('Mermaid export/import', () => {
  it('produces a mermaid string with metadata comments', () => {
    const diagram = createEmptyDiagram();
    const output = exportDiagramToMermaid(diagram);

    expect(output).toContain('```mermaid');
    expect(output).toContain('flowchart TD');
    expect(output).toContain('%% Swimlane Studio Export v1');
    expect(output).toContain('subgraph');
  });

  it('restores diagram structure after round trip', () => {
    const original = createEmptyDiagram();
    original.title = 'ラウンドトリップテスト';
    const serialized = exportDiagramToMermaid(original);
    const imported = importMermaidToDiagram(serialized);

    expect(imported.lanes.length).toBe(original.lanes.length);
    expect(imported.steps.length).toBe(original.steps.length);
    expect(imported.lanes[0].title).toBe(original.lanes[0].title);
    expect(imported.steps[0].title).toBe(original.steps[0].title);
    expect(imported.steps[0].kind).toBe(original.steps[0].kind);
  });
});
