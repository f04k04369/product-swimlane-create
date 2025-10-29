import { nanoid } from 'nanoid/non-secure';
import { deriveStepX, rowIndexFromY, yForRow } from '@/lib/diagram/layout';
import type { Connection, Diagram, Lane, MarkerKind, PhaseGroup, Step, StepKind } from '@/lib/diagram/types';

class MermaidParseError extends Error {}

const KIND_COLORS: Record<StepKind, string> = {
  process: '#1f2937',
  decision: '#9333ea',
  start: '#16a34a',
  end: '#dc2626',
  file: '#0ea5e9',
};

const isStepKind = (value: unknown): value is StepKind =>
  value === 'process' || value === 'decision' || value === 'start' || value === 'end' || value === 'file';

const parseJsonMeta = (label: string, value?: string) => {
  if (!value) return null;
  try {
    return JSON.parse(value.trim());
  } catch (error) {
    throw new MermaidParseError(`${label} のJSON解析に失敗しました`);
  }
};

const normalizeContent = (input: string) =>
  input
    .replace(/```mermaid/g, '')
    .replace(/```/g, '')
    .trim();

export const importMermaidToDiagram = (content: string): Diagram => {
  const cleaned = normalizeContent(content);

  if (!cleaned.includes('Swimlane Studio Export')) {
    throw new MermaidParseError('このMermaidファイルはSwimlane Studio形式ではありません');
  }

  const diagramMetaMatch = cleaned.match(/%%\s*diagram-meta:(.+)/);
  const diagramMeta = parseJsonMeta('diagram-meta', diagramMetaMatch?.[1]) ?? {};

  const persistedMatch = cleaned.match(/%%\s*swimlane-json:(.+)/);
  const persistedState = parseJsonMeta('swimlane-json', persistedMatch?.[1]);

  const lanes: Lane[] = [];
  const steps: Step[] = [];
  const stepAliasMap = new Map<string, string>();
  const phaseMetas: PhaseGroup[] = [];

  if (
    persistedState &&
    Array.isArray(persistedState.lanes) &&
    Array.isArray(persistedState.steps) &&
    Array.isArray(persistedState.connections)
  ) {
    const sanitizedLanes = (persistedState.lanes as Lane[])
      .map((lane, index): Lane => sanitizeLane(lane, index))
      .sort((a, b) => a.order - b.order)
      .map((lane, index): Lane => ({ ...lane, order: index }));
    const laneMap = new Map(sanitizedLanes.map((lane) => [lane.id, lane] as const));
    const sanitizedSteps = (persistedState.steps as Step[])
      .map((step, index) => sanitizeStep(step, sanitizedLanes, index))
      .filter((step): step is Step => laneMap.has(step.laneId));
    const sanitizedConnections = ((persistedState.connections ?? []) as Connection[])
      .map((connection) => sanitizeConnection(connection, sanitizedSteps))
      .filter((connection): connection is Connection => Boolean(connection));
    const sanitizedPhases = Array.isArray(persistedState.phaseGroups)
      ? (persistedState.phaseGroups as PhaseGroup[])
          .map((phase, index) => sanitizePhaseGroup(phase, index))
          .filter(Boolean)
          .sort((a, b) => a.startRow - b.startRow)
      : [];

    const now = new Date().toISOString();

    return {
      id: typeof diagramMeta.id === 'string' ? diagramMeta.id : nanoid(),
      title: diagramMeta.title ?? 'インポートしたスイムレーン',
      lanes: sanitizedLanes,
      steps: sanitizedSteps,
      connections: sanitizedConnections,
      phaseGroups: sanitizedPhases,
      createdAt: diagramMeta.createdAt ?? now,
      updatedAt: now,
    };
  }

  const laneRegex = /subgraph\s+([A-Za-z0-9_-]+)\s*\["([^"]*)"\]\s*([\s\S]*?)\nend/g;
  let laneMatch: RegExpExecArray | null;
  let laneOrder = 0;

  while ((laneMatch = laneRegex.exec(cleaned)) !== null) {
    const [, , laneTitleRaw, laneBody] = laneMatch;
    const laneMetaMatch = laneBody.match(/%%\s*lane-meta:(.+)/);
    const laneMeta = parseJsonMeta('lane-meta', laneMetaMatch?.[1]) ?? {};

    const laneId = laneMeta.id ?? nanoid();
    const laneTitle = laneMeta.title ?? laneTitleRaw;
    const laneDescription = laneMeta.description ?? '';
    const laneColor = laneMeta.color ?? '#0ea5e9';

    const lane: Lane = {
      id: laneId,
      title: laneTitle,
      description: laneDescription,
      order: laneOrder,
      color: laneColor,
    };
    lanes.push(lane);

    const stepRegex = /([A-Za-z0-9_-]+)\s*\["([^"]*)"\]\s*(?:\n\s*%%\s*step-meta:(.+))?/g;
    let stepMatch: RegExpExecArray | null;
    while ((stepMatch = stepRegex.exec(laneBody)) !== null) {
      const [, stepAlias, stepTitleRaw, stepMetaRaw] = stepMatch;
      const stepMeta = parseJsonMeta('step-meta', stepMetaRaw) ?? {};

      const stepId = stepMeta.id ?? nanoid();
      const stepTitle = stepMeta.title ?? stepTitleRaw;
      const description = stepMeta.description ?? '';
      const width = typeof stepMeta.width === 'number' ? stepMeta.width : 240;
      const height = typeof stepMeta.height === 'number' ? stepMeta.height : 120;
      const existingLaneSteps = steps.filter((item) => item.laneId === laneId);
      const userOrder = typeof stepMeta.userOrder === 'number' ? stepMeta.userOrder : undefined;
      const inferredOrder =
        typeof stepMeta.y === 'number' ? rowIndexFromY(stepMeta.y, height) : undefined;
      const order =
        typeof stepMeta.order === 'number'
          ? stepMeta.order
          : userOrder ?? inferredOrder ?? existingLaneSteps.length;
      const rawKind = stepMeta.kind;
      const kind: StepKind = isStepKind(rawKind) ? rawKind : 'process';
      const userX = typeof stepMeta.userX === 'number' ? stepMeta.userX : undefined;
      const userY = typeof stepMeta.userY === 'number' ? stepMeta.userY : undefined;
      const x = typeof userX === 'number' ? userX : typeof stepMeta.x === 'number' ? stepMeta.x : deriveStepX(lane.order, width);
      const y =
        typeof userY === 'number'
          ? userY
          : typeof stepMeta.y === 'number'
          ? stepMeta.y
          : yForRow(order, height);
      const color = stepMeta.color ?? KIND_COLORS[kind] ?? '#1f2937';

      const step: Step = {
        id: stepId,
        laneId: laneId,
        title: stepTitle,
        description,
        order,
        x,
        y,
        width,
        height,
        color,
        kind,
      };
      steps.push(step);
      stepAliasMap.set(stepAlias, stepId);
    }

    laneOrder += 1;
  }

  if (!lanes.length || !steps.length) {
    throw new MermaidParseError('レーンまたはステップが検出できませんでした');
  }

  const phaseMetaRegex = /%%\s*phase-meta:(.+)/g;
  let phaseMatch: RegExpExecArray | null;
  while ((phaseMatch = phaseMetaRegex.exec(cleaned)) !== null) {
    const parsed = parseJsonMeta('phase-meta', phaseMatch[1]);
    if (parsed) {
      phaseMetas.push(sanitizePhaseGroup(parsed as PhaseGroup, phaseMetas.length));
    }
  }

  const edgeMetas: Array<Record<string, unknown>> = [];
  const edgeMetaRegex = /%%\s*edge-meta:(.+)/g;
  let edgeMetaMatch: RegExpExecArray | null;
  while ((edgeMetaMatch = edgeMetaRegex.exec(cleaned)) !== null) {
    const parsed = parseJsonMeta('edge-meta', edgeMetaMatch[1]);
    if (parsed) {
      edgeMetas.push(parsed);
    }
  }

  const connections = [] as Diagram['connections'];
  const edgeRegex = /^([A-Za-z0-9_-]+)\s*-->(?:\|([^|]+)\|)?\s*([A-Za-z0-9_-]+)/gm;
  let edgeMatch: RegExpExecArray | null;
  while ((edgeMatch = edgeRegex.exec(cleaned)) !== null) {
    const [, sourceAlias, labelRaw, targetAlias] = edgeMatch;
    const sourceId = stepAliasMap.get(sourceAlias);
    const targetId = stepAliasMap.get(targetAlias);
    if (!sourceId || !targetId) continue;

    const normalized = typeof labelRaw === 'string' ? labelRaw.trim() : '';
    let label = normalized.replace(/<br\s*\/?\>/gi, '\n').slice(0, 50);
    const metaIndex = edgeMetas.findIndex((meta) => meta?.sourceId === sourceId && meta?.targetId === targetId);
    let sourceHandle: string | undefined;
    let targetHandle: string | undefined;
    let control: { x: number; y: number } | null = null;
    let startMarker: MarkerKind | undefined;
    let endMarker: MarkerKind | undefined;
    let markerSize: number | undefined;
    if (metaIndex !== -1) {
      const meta = edgeMetas.splice(metaIndex, 1)[0];
        if (meta) {
          sourceHandle = typeof meta.sourceHandle === 'string' && meta.sourceHandle.length ? meta.sourceHandle : undefined;
          targetHandle = typeof meta.targetHandle === 'string' && meta.targetHandle.length ? meta.targetHandle : undefined;
          if (meta.control && typeof (meta.control as { x?: unknown; y?: unknown }).x === 'number' && typeof (meta.control as { x?: unknown; y?: unknown }).y === 'number') {
            control = {
              x: (meta.control as { x: number; y: number }).x,
              y: (meta.control as { x: number; y: number }).y,
            };
          }
          if (meta.startMarker === 'none' || meta.startMarker === 'arrow' || meta.startMarker === 'dot') {
            startMarker = meta.startMarker;
          }
          if (meta.endMarker === 'none' || meta.endMarker === 'arrow' || meta.endMarker === 'dot') {
            endMarker = meta.endMarker;
          }
          if (typeof meta.markerSize === 'number') {
            markerSize = meta.markerSize;
          }
          if (typeof meta.label === 'string') {
            label = meta.label.slice(0, 50);
          }
        }
      }

    connections.push({
      id: nanoid(),
      sourceId,
      targetId,
      label,
      sourceHandle,
      targetHandle,
      control,
      startMarker,
      endMarker,
      markerSize,
    });
  }

  const now = new Date().toISOString();

  return {
    id: typeof diagramMeta.id === 'string' ? diagramMeta.id : nanoid(),
    title: diagramMeta.title ?? 'インポートしたスイムレーン',
    lanes,
    steps,
    connections,
    phaseGroups: phaseMetas,
    createdAt: diagramMeta.createdAt ?? now,
    updatedAt: now,
  };
};

export class MermaidImportError extends MermaidParseError {}
const sanitizeLane = (lane: Lane, index: number): Lane => ({
  id: typeof lane.id === 'string' ? lane.id : nanoid(),
  title: typeof lane.title === 'string' ? lane.title : `レーン ${index + 1}`,
  description: typeof lane.description === 'string' ? lane.description : '',
  order: typeof lane.order === 'number' ? lane.order : index,
  color: typeof lane.color === 'string' ? lane.color : '#0ea5e9',
});

const sanitizeStep = (step: Step, lanes: Lane[], index: number): Step => {
  const fallbackLane = lanes[0];
  const laneId = typeof step.laneId === 'string' && lanes.some((lane) => lane.id === step.laneId)
    ? step.laneId
    : fallbackLane?.id ?? nanoid();
  const kind: StepKind = step.kind === 'decision' || step.kind === 'start' || step.kind === 'end' || step.kind === 'file' ? step.kind : 'process';
  const width = typeof step.width === 'number' ? step.width : 240;
  const height = typeof step.height === 'number' ? step.height : 120;
  const order = typeof step.order === 'number' ? step.order : index;
  const x = typeof step.x === 'number' ? step.x : deriveStepX(lanes.find((lane) => lane.id === laneId)?.order ?? 0, width);
  const y = typeof step.y === 'number' ? step.y : yForRow(order, height);
  return {
    id: typeof step.id === 'string' ? step.id : nanoid(),
    laneId,
    title: typeof step.title === 'string' ? step.title : `ステップ ${index + 1}`,
    description: typeof step.description === 'string' ? step.description : '',
    order,
    x,
    y,
    width,
    height,
    color: typeof step.color === 'string' ? step.color : KIND_COLORS[kind] ?? '#1f2937',
    kind,
  };
};

const sanitizeConnection = (connection: Connection, steps: Step[]): Connection | null => {
  const sourceId = typeof connection.sourceId === 'string' ? connection.sourceId : null;
  const targetId = typeof connection.targetId === 'string' ? connection.targetId : null;
  if (!sourceId || !targetId) return null;
  if (!steps.some((step) => step.id === sourceId) || !steps.some((step) => step.id === targetId)) return null;
  const label = typeof connection.label === 'string' ? connection.label.slice(0, 50) : '';
  const startMarker = connection.startMarker === 'arrow' || connection.startMarker === 'dot' ? connection.startMarker : 'none';
  const endMarker = connection.endMarker === 'arrow' || connection.endMarker === 'dot' ? connection.endMarker : 'arrow';
  const markerSize = typeof connection.markerSize === 'number' ? connection.markerSize : 16;
  return {
    id: typeof connection.id === 'string' ? connection.id : nanoid(),
    sourceId,
    targetId,
    sourceHandle: typeof connection.sourceHandle === 'string' ? connection.sourceHandle : undefined,
    targetHandle: typeof connection.targetHandle === 'string' ? connection.targetHandle : undefined,
    control:
      connection.control && typeof connection.control === 'object' && typeof (connection.control as { x?: unknown; y?: unknown }).x === 'number' && typeof (connection.control as { x?: unknown; y?: unknown }).y === 'number'
        ? { x: (connection.control as { x: number; y: number }).x, y: (connection.control as { x: number; y: number }).y }
        : null,
    startMarker,
    endMarker,
    markerSize,
    label,
  };
};

const sanitizePhaseGroup = (phase: PhaseGroup, index: number): PhaseGroup => {
  const rawStart = typeof phase.startRow === 'number' ? Math.floor(phase.startRow) : index;
  const rawEnd = typeof phase.endRow === 'number' ? Math.floor(phase.endRow) : rawStart;
  const normalizedStart = Math.max(0, Math.min(rawStart, rawEnd));
  const normalizedEnd = Math.max(normalizedStart, Math.max(rawStart, rawEnd));
  return {
    id: typeof phase.id === 'string' ? phase.id : nanoid(),
    title: typeof phase.title === 'string' ? phase.title : `フェーズ ${index + 1}`,
    startRow: normalizedStart,
    endRow: normalizedEnd,
  };
};
