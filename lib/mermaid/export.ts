import type { Diagram, Lane, Step, StepKind } from '@/lib/diagram/types';

const STEP_KIND_FILL: Record<StepKind, string> = {
  process: '#ffffff',
  decision: '#ede9fe',
  start: '#dcfce7',
  end: '#fee2e2',
  file: '#f0f9ff',
  loop: '#e0ebff',
  database: '#e0ebff',
};

const escapeLabel = (text: string) => text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const stepMeta = (step: Step) =>
  JSON.stringify({
    id: step.id,
    laneId: step.laneId,
    title: step.title,
    description: step.description ?? '',
    order: step.order,
    x: step.x,
    y: step.y,
    width: step.width,
    height: step.height,
    color: step.color,
    kind: step.kind,
  });

const laneMeta = (lane: Lane) =>
  JSON.stringify({
    id: lane.id,
    title: lane.title,
    description: lane.description ?? '',
    order: lane.order,
    color: lane.color,
  });

export const exportDiagramToMermaid = (diagram: Diagram): string => {
  const lines: string[] = [];
  const stepAliasMap = new Map<string, string>();
  const orientation = diagram.orientation === 'horizontal' ? 'horizontal' : 'vertical';
  const flowDirection = orientation === 'horizontal' ? 'LR' : 'TD';

  lines.push('```mermaid');
  lines.push(`flowchart ${flowDirection}`);
  lines.push('%% Swimlane Studio Export v1');
  lines.push(
    `%% diagram-meta:${JSON.stringify({
      id: diagram.id,
      title: diagram.title,
      createdAt: diagram.createdAt,
      updatedAt: diagram.updatedAt,
      orientation,
    })}`
  );

  const persistedState = {
    orientation,
    lanes: diagram.lanes,
    steps: diagram.steps,
    connections: diagram.connections,
    phaseGroups: diagram.phaseGroups ?? [],
  };
  lines.push(`%% swimlane-json:${JSON.stringify(persistedState)}`);

  (diagram.phaseGroups ?? []).forEach((phase) => {
    lines.push(`%% phase-meta:${JSON.stringify(phase)}`);
  });

  if (diagram.steps.some((step) => step.kind === 'file')) {
    lines.push('classDef file fill:#f0f9ff,stroke:#0ea5e9,color:#0f172a;');
  }

  const sortedLanes = diagram.lanes.slice().sort((a, b) => a.order - b.order);

  let stepCounter = 0;
  sortedLanes.forEach((lane, laneIndex) => {
    const laneAlias = `L${laneIndex}`;
    lines.push(`subgraph ${laneAlias}["${escapeLabel(lane.title)}"]`);
    lines.push(`    %% lane-meta:${laneMeta(lane)}`);

    const laneSteps = diagram.steps
      .filter((step) => step.laneId === lane.id)
      .slice()
      .sort((a, b) => {
        if (orientation === 'horizontal') {
          const deltaX = (a.x ?? 0) - (b.x ?? 0);
          if (deltaX !== 0) return deltaX;
          return a.order - b.order;
        }
        const deltaY = (a.y ?? 0) - (b.y ?? 0);
        if (deltaY !== 0) return deltaY;
        return a.order - b.order;
      });

    laneSteps.forEach((step) => {
      const stepAlias = `S${stepCounter++}`;
      stepAliasMap.set(step.id, stepAlias);
      const label = escapeLabel(step.title || 'Untitled step');
      lines.push(`    ${stepAlias}["${label}"]`);
      lines.push(`    %% step-meta:${stepMeta(step)}`);
      const fillColor = STEP_KIND_FILL[step.kind] ?? '#ffffff';
      const strokeColor = lane.color || '#0ea5e9';
      const textColor = step.color || '#1f2937';
      lines.push(`    style ${stepAlias} fill:${fillColor},stroke:${strokeColor},color:${textColor}`);
      if (step.kind === 'file') {
        lines.push(`    class ${stepAlias} file`);
      }
      if (step.kind === 'loop') {
        // Replace default rect shape with trapezoid
        // Mermaid syntax for trapezoid: id[\"label"/]
        const lastIndex = lines.length - 1;
        // Find the line defining the node: stepAlias["label"]
        // We need to replace ["..."] with [\"..."/]
        // Note: Mermaid doesn't support inverted trapezoid easily with standard flowchart shapes in all versions,
        // but [\ ... /] is the syntax for trapezoid (inverted).
        // Actually, standard trapezoid is [/ ... \], inverted is [\ ... /].
        // Let's use [\ ... /] for Loop Start/End as requested (inverted trapezoid).
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes(`${stepAlias}["`)) {
            lines[i] = lines[i].replace(`${stepAlias}["`, `${stepAlias}[\\"`).replace(`"]`, `"/]`);
            break;
          }
        }
      }
      if (step.kind === 'database') {
        // Replace default rect shape with cylinder
        // Mermaid syntax for cylinder: id[(label)]
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes(`${stepAlias}["`)) {
            lines[i] = lines[i].replace(`${stepAlias}["`, `${stepAlias}[("`).replace(`"]`, `")]`);
            break;
          }
        }
      }
    });

    lines.push('end');
  });

  if (diagram.connections.length) {
    lines.push('');
    diagram.connections.forEach((connection) => {
      const sourceAlias = stepAliasMap.get(connection.sourceId);
      const targetAlias = stepAliasMap.get(connection.targetId);
      if (!sourceAlias || !targetAlias) return;
      const labelText = connection.label?.trim();
      const label = labelText
        ? `|${escapeLabel(labelText).replace(/\\n/g, '<br/>').replace(/\n/g, '<br/>')}|`
        : '';
      lines.push(`${sourceAlias} -->${label} ${targetAlias}`);
      const edgeMeta = {
        id: connection.id,
        sourceId: connection.sourceId,
        targetId: connection.targetId,
        label: connection.label ?? '',
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
        control: connection.control ?? null,
        startMarker: connection.startMarker ?? 'none',
        endMarker: connection.endMarker ?? 'arrow',
        markerSize: connection.markerSize ?? 16,
      };
      lines.push(`%% edge-meta:${JSON.stringify(edgeMeta)}`);
    });
  }

  lines.push('```');

  return lines.join('\n');
};
