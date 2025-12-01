export type ElementID = string;

export interface Lane {
  id: ElementID;
  title: string;
  description?: string;
  order: number;
  color: string;
  width: number;
}

export interface Step {
  id: ElementID;
  laneId: ElementID;
  title: string;
  description?: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fillColor?: string;
  kind: StepKind;
}

export type StepKind = 'process' | 'decision' | 'start' | 'end' | 'file';

export type MarkerKind = 'none' | 'arrow' | 'dot';

export interface Connection {
  id: ElementID;
  sourceId: ElementID;
  targetId: ElementID;
  sourceHandle?: string;
  targetHandle?: string;
  control?: { x: number; y: number } | null;
  startMarker?: MarkerKind;
  endMarker?: MarkerKind;
  markerSize?: number;
  label?: string;
}

export interface PhaseGroup {
  id: ElementID;
  title: string;
  startRow: number;
  endRow: number;
}

export type DiagramOrientation = 'vertical' | 'horizontal';

export interface Diagram {
  id: string;
  title: string;
  orientation: DiagramOrientation;
  lanes: Lane[];
  steps: Step[];
  connections: Connection[];
  phaseGroups: PhaseGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface SelectionState {
  lanes: ElementID[];
  steps: ElementID[];
  connections: ElementID[];
  phases: ElementID[];
}

export interface DiagramHistoryEntry {
  diagram: Diagram;
  label: string;
  timestamp: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  targetType: 'lane' | 'step' | 'connection' | 'diagram';
  targetId?: ElementID;
  payload?: Record<string, unknown>;
  timestamp: number;
}
