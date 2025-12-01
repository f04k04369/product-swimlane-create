import { create } from 'zustand';
import { nanoid } from 'nanoid/non-secure';
import { createEmptyDiagram, getLaneColor, STEP_DEFAULT_SIZE } from '@/lib/diagram/defaults';
import {
  COLUMN_WIDTH,
  HORIZONTAL_HEADER_WIDTH,
  LANE_PADDING,
  columnIndexFromX,
  deriveLanePositionY,
  deriveStepX,
  horizontalColumnLeft,
  resolveLaneIndex,
  resolveLaneIndexByY,
  rowIndexFromY,
  yForRow,
} from '@/lib/diagram/layout';
import type {
  AuditEntry,
  Diagram,
  DiagramHistoryEntry,
  DiagramOrientation,
  ElementID,
  Lane,
  PhaseGroup,
  SelectionState,
  Step,
  StepKind,
  MarkerKind,
} from '@/lib/diagram/types';

type LaneUpdate = Partial<Omit<Lane, 'id' | 'order'>> & { order?: number };
type StepUpdate = Partial<Omit<Step, 'id'>>;

const HISTORY_LIMIT = 50;

const KIND_DIMENSIONS: Record<StepKind, { width: number; height: number }> = {
  process: { width: STEP_DEFAULT_SIZE.width, height: STEP_DEFAULT_SIZE.height },
  decision: { width: 220, height: 160 },
  start: { width: 220, height: 110 },
  end: { width: 220, height: 110 },
  file: { width: STEP_DEFAULT_SIZE.width, height: STEP_DEFAULT_SIZE.height },
};

const KIND_COLORS: Record<StepKind, string> = {
  process: '#000000',
  decision: '#000000',
  start: '#000000',
  end: '#000000',
  file: '#000000',
};

const KIND_FILL_COLORS: Record<StepKind, string> = {
  process: '#e0ebff',
  decision: '#e4c9fd',
  start: '#c2ffd8',
  end: '#ffd1d1',
  file: '#fff4ad',
};

interface DiagramStore {
  diagram: Diagram;
  selection: SelectionState;
  isOrientationCommitted: boolean;
  auditTrail: AuditEntry[];
  undoStack: DiagramHistoryEntry[];
  redoStack: DiagramHistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  pendingInsert: { laneId: ElementID; row: number } | null;
  scrollToTopCounter: number;
  setDiagram: (diagram: Diagram, options?: { label?: string; preserveLayout?: boolean }) => void;
  initializeDiagram: (orientation: DiagramOrientation) => void;
  addLane: (title?: string) => void;
  updateLane: (id: ElementID, updates: LaneUpdate) => void;
  removeLane: (id: ElementID) => void;
  addStep: (options?: { title?: string; kind?: StepKind }) => ElementID | null;
  updateStep: (id: ElementID, updates: StepUpdate) => void;
  moveStep: (id: ElementID, x: number, y: number) => void;
  reorderStep: (id: ElementID, targetIndex: number) => void;
  moveStepUp: (id: ElementID) => void;
  moveStepDown: (id: ElementID) => void;
  changeStepKind: (id: ElementID, kind: StepKind) => void;
  removeStep: (id: ElementID) => void;
  reorderLane: (id: ElementID, newOrder: number) => void;
  addConnection: (
    sourceId: ElementID,
    targetId: ElementID,
    sourceHandle?: string | null,
    targetHandle?: string | null
  ) => void;
  updateConnectionLabel: (connectionId: ElementID, label: string) => void;
  updateConnectionMarker: (
    connectionId: ElementID,
    updates: Partial<{ startMarker: MarkerKind; endMarker: MarkerKind; markerSize: number }>
  ) => void;
  updateConnectionControl: (connectionId: ElementID, control: { x: number; y: number } | null) => void;
  updateConnectionEndpoints: (
    connectionId: ElementID,
    updates: {
      sourceId?: ElementID;
      targetId?: ElementID;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }
  ) => void;
  reverseConnection: (connectionId: ElementID) => void;
  removeConnection: (connectionId: ElementID) => void;
  shiftRows: (
    row: number,
    amount: number,
    options: { scope: 'lane' | 'all'; laneId?: ElementID; direction?: 'down' | 'up' }
  ) => void;
  setSelection: (selection: Partial<SelectionState>) => void;
  clearSelection: () => void;
  setPendingInsert: (laneId: ElementID, row: number) => void;
  clearPendingInsert: () => void;
  addPhaseGroup: (startRow: number, endRow: number, title: string) => string;
  updatePhaseGroup: (id: ElementID, updates: Partial<Omit<PhaseGroup, 'id'>>) => void;
  removePhaseGroup: (id: ElementID) => void;
  requestScrollToTop: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  log: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
}

const cloneDiagram = (diagram: Diagram): Diagram => structuredClone(diagram);

const layoutLaneSteps = (diagram: Diagram, laneId: ElementID, providedSteps?: Step[]) => {
  const lane = diagram.lanes.find((item) => item.id === laneId);
  if (!lane) return;

  const laneSteps = providedSteps
    ? [...providedSteps]
    : diagram.steps
        .filter((step) => step.laneId === laneId)
        .slice()
        .sort((a, b) => a.order - b.order);

  const occupiedRows = new Set<number>();

  laneSteps
    .sort((a, b) => a.order - b.order)
    .forEach((step) => {
      const desiredRow = Number.isFinite(step.order) ? Math.max(0, Math.round(step.order)) : 0;
      let row = desiredRow;
      while (occupiedRows.has(row)) {
        row += 1;
      }
      occupiedRows.add(row);

      step.order = row;
      step.laneId = lane.id;
      if (diagram.orientation === 'horizontal') {
        const laneTop = deriveLanePositionY(diagram.lanes, lane.order);
        const laneThickness = lane.width;
        const columnOffset = horizontalColumnLeft(row);
        const centeredOffset = Math.max(0, (COLUMN_WIDTH - step.width) / 2);
        step.x = HORIZONTAL_HEADER_WIDTH + LANE_PADDING + columnOffset + centeredOffset;
        step.y = laneTop + Math.max(0, (laneThickness - step.height) / 2);
      } else {
        step.x = deriveStepX(diagram.lanes, lane.order, step.width);
        step.y = yForRow(row, step.height);
      }
    });
};

const recalcAllLaneLayouts = (diagram: Diagram) => {
  diagram.lanes.forEach((lane) => layoutLaneSteps(diagram, lane.id));
};

const sortSteps = (diagram: Diagram) => {
  diagram.steps.sort((a, b) => {
    const laneOrderA = diagram.lanes.find((lane) => lane.id === a.laneId)?.order ?? 0;
    const laneOrderB = diagram.lanes.find((lane) => lane.id === b.laneId)?.order ?? 0;
    if (laneOrderA !== laneOrderB) return laneOrderA - laneOrderB;
    return a.order - b.order;
  });
};

const sanitizeLaneColor = (color?: string) => {
  if (typeof color !== 'string') return undefined;
  const trimmed = color.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};

const normalizeLaneOrder = (lanes: Lane[]) =>
  lanes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((lane, index) => {
      const sanitizedColor = sanitizeLaneColor(lane.color);
      return {
        ...lane,
        order: index,
        color: sanitizedColor ?? getLaneColor(index),
      };
    });

const removeStepFromDiagram = (diagram: Diagram, stepId: ElementID) => {
  const index = diagram.steps.findIndex((step) => step.id === stepId);
  if (index === -1) return undefined;
  const [step] = diagram.steps.splice(index, 1);
  return step;
};

export const useDiagramStore = create<DiagramStore>((set, get) => {
  const commit = (
    updater: (diagram: Diagram) => void,
    historyLabel: string,
    audit?: Omit<AuditEntry, 'id' | 'timestamp'>
  ) => {
    const { diagram, undoStack, auditTrail } = get();
    const base = cloneDiagram(diagram);
    updater(base);
    base.updatedAt = new Date().toISOString();

    const historyEntry: DiagramHistoryEntry = {
      diagram: cloneDiagram(diagram),
      label: historyLabel,
      timestamp: Date.now(),
    };

    const nextUndo = [...undoStack, historyEntry].slice(-HISTORY_LIMIT);
    const nextAudit = audit
      ? [
          ...auditTrail,
          {
            id: nanoid(),
            timestamp: Date.now(),
            ...audit,
          },
        ]
      : auditTrail;

    set({
      diagram: base,
      undoStack: nextUndo,
      redoStack: [],
      canUndo: nextUndo.length > 0,
      canRedo: false,
      auditTrail: nextAudit,
    });
  };

  return {
    diagram: createEmptyDiagram('vertical'),
    isOrientationCommitted: false,
    selection: { lanes: [], steps: [], connections: [], phases: [] },
    auditTrail: [],
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    pendingInsert: null,
    scrollToTopCounter: 0,

    setDiagram: (diagram, options) => {
      const { label = 'import diagram', preserveLayout = false } = options ?? {};
      const snapshot = cloneDiagram(diagram);
      snapshot.orientation = diagram.orientation ?? 'vertical';
      snapshot.updatedAt = new Date().toISOString();
      const originalLaneMeta = new Map(snapshot.lanes.map((lane) => [lane.id, { color: lane.color }])) ;
      const originalStepMeta = new Map(
        snapshot.steps.map((step) => [step.id, { x: step.x, y: step.y, width: step.width, height: step.height, order: step.order, color: step.color }])
      );
      const laneMap = new Map(snapshot.lanes.map((lane) => [lane.id, lane] as const));
      snapshot.lanes = snapshot.lanes
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((lane, index) => ({
          ...lane,
          order: index,
          color: originalLaneMeta.get(lane.id)?.color ?? lane.color ?? getLaneColor(index),
        }));
      const normalizedLaneMap = new Map(snapshot.lanes.map((lane) => [lane.id, lane] as const));
      snapshot.steps = snapshot.steps.map((step, index) => {
        const lane = normalizedLaneMap.get(step.laneId) ?? laneMap.get(step.laneId);
        const targetLane = lane ?? snapshot.lanes[0];
        const width = step.width ?? STEP_DEFAULT_SIZE.width;
        const order = typeof step.order === 'number' ? step.order : index;
        const height = step.height ?? STEP_DEFAULT_SIZE.height;
        return {
          ...step,
          laneId: targetLane ? targetLane.id : step.laneId,
          order,
          width,
          height,
          kind: step.kind ?? 'process',
          color: step.color ?? '#000000',
          fillColor: step.fillColor ?? KIND_FILL_COLORS[(step.kind ?? 'process') as StepKind] ?? '#e0ebff',
          x: preserveLayout && typeof step.x === 'number' ? step.x : 0,
          y: preserveLayout && typeof step.y === 'number' ? step.y : 0,
        };
      });
      if (!preserveLayout) {
        recalcAllLaneLayouts(snapshot);
      }
      snapshot.phaseGroups = (diagram.phaseGroups ?? []).map((phase) => {
        const start = Math.max(0, Math.min(Math.floor(phase.startRow), Math.floor(phase.endRow)));
        const end = Math.max(start, Math.max(Math.floor(phase.startRow), Math.floor(phase.endRow)));
        return {
          id: phase.id ?? nanoid(),
          title: phase.title ?? '',
          startRow: start,
          endRow: end,
        } satisfies PhaseGroup;
      }).sort((a, b) => a.startRow - b.startRow);
      snapshot.steps = snapshot.steps.map((step) => {
        const original = originalStepMeta.get(step.id);
        if (!original) return step;
        const next = { ...step };
        if (typeof original.width === 'number') {
          next.width = original.width;
        }
        if (typeof original.height === 'number') {
          next.height = original.height;
        }
        if (typeof original.color === 'string' && original.color.length) {
          next.color = original.color;
        }
        if (preserveLayout && typeof original.x === 'number' && Number.isFinite(original.x)) {
          next.x = original.x;
        }
        if (preserveLayout && typeof original.y === 'number' && Number.isFinite(original.y)) {
          next.y = original.y;
        }
        if (typeof original.order === 'number') {
          next.order = original.order;
        }
        return next;
      });
      sortSteps(snapshot);
      set({
        diagram: snapshot,
        isOrientationCommitted: true,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        selection: { lanes: [], steps: [], connections: [], phases: [] },
        pendingInsert: null,
      });
      get().log({ action: label, targetType: 'diagram', targetId: snapshot.id });
    },

    initializeDiagram: (orientation) => {
      let initialized = false;
      set((state) => {
        if (state.isOrientationCommitted) {
          return state;
        }
        initialized = true;
        return {
          diagram: createEmptyDiagram(orientation),
          isOrientationCommitted: true,
          selection: { lanes: [], steps: [], connections: [], phases: [] },
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
          pendingInsert: null,
        };
      });
      if (initialized) {
        get().log({ action: 'initialize_diagram', targetType: 'diagram' });
      }
    },

    addLane: (title = '新しいレーン') => {
      commit((draft) => {
        const order = draft.lanes.length;
        draft.lanes.push({
          id: nanoid(),
          title,
          description: '',
          order,
          color: getLaneColor(order),
          width: 320,
        });
        draft.lanes = normalizeLaneOrder(draft.lanes);
        recalcAllLaneLayouts(draft);
        sortSteps(draft);
      }, 'add lane', {
        action: 'add_lane',
        targetType: 'lane',
      });
    },

    updateLane: (id, updates) => {
      commit((draft) => {
        const lane = draft.lanes.find((item) => item.id === id);
        if (!lane) return;
        const nextUpdates = { ...updates };
        if (typeof nextUpdates.color === 'string') {
          const sanitizedColor = sanitizeLaneColor(nextUpdates.color);
          nextUpdates.color = sanitizedColor ?? getLaneColor(lane.order);
        }
        Object.assign(lane, nextUpdates);
        if (typeof nextUpdates.order === 'number') {
          draft.lanes = normalizeLaneOrder(draft.lanes);
        }
        recalcAllLaneLayouts(draft);
        sortSteps(draft);
      }, 'update lane', {
        action: 'update_lane',
        targetType: 'lane',
        targetId: id,
        payload: updates,
      });
    },

    removeLane: (id) => {
      commit((draft) => {
        draft.lanes = normalizeLaneOrder(draft.lanes.filter((lane) => lane.id !== id));
        draft.steps = draft.steps.filter((step) => step.laneId !== id);
        draft.connections = draft.connections.filter((connection) =>
          draft.steps.some((step) => step.id === connection.sourceId || step.id === connection.targetId)
        );
        recalcAllLaneLayouts(draft);
      }, 'remove lane', {
        action: 'remove_lane',
        targetType: 'lane',
        targetId: id,
      });
      set((state) =>
        state.pendingInsert && state.pendingInsert.laneId === id ? { pendingInsert: null } : {}
      );
    },

    reorderLane: (id, newOrder) => {
      commit((draft) => {
        const lane = draft.lanes.find((item) => item.id === id);
        if (!lane) return;
        const bounded = Math.max(0, Math.min(newOrder, draft.lanes.length - 1));
        const sorted = draft.lanes
          .filter((item) => item.id !== id)
          .sort((a, b) => a.order - b.order);
        sorted.splice(bounded, 0, lane);
        draft.lanes = normalizeLaneOrder(sorted);
        recalcAllLaneLayouts(draft);
        sortSteps(draft);
      }, 'reorder lane', {
        action: 'reorder_lane',
        targetType: 'lane',
        targetId: id,
        payload: { newOrder },
      });
    },

    addStep: (options) => {
      const pending = get().pendingInsert;
      if (!pending) return null;
      const insertRow = Math.max(0, pending.row);
      const { title = '新しいステップ', kind = 'process' } = options ?? {};
      let createdId: ElementID | null = null;
      commit((draft) => {
        const lane = draft.lanes.find((item) => item.id === pending.laneId);
        if (!lane) return;
        const dimensions = KIND_DIMENSIONS[kind];
        const hasStepAtRow = draft.steps.some(
          (candidate) => candidate.laneId === lane.id && candidate.order === insertRow
        );
        if (hasStepAtRow) {
          draft.steps
            .filter((candidate) => candidate.laneId === lane.id && candidate.order >= insertRow)
            .forEach((candidate) => {
              candidate.order += 1;
            });
        }
        const newStep: Step = {
          id: nanoid(),
          laneId: lane.id,
          title,
          description: '',
          order: insertRow,
          width: dimensions.width,
          height: dimensions.height,
          color: KIND_COLORS[kind],
          fillColor: KIND_FILL_COLORS[kind],
          kind,
          x: 0,
          y: 0,
        };
        draft.steps.push(newStep);
        layoutLaneSteps(draft, lane.id);
        sortSteps(draft);
        createdId = newStep.id;
      }, 'add step', {
        action: 'add_step',
        targetType: 'step',
        payload: { laneId: pending.laneId, row: pending.row, kind },
      });
      if (createdId) {
        set({
          pendingInsert: { laneId: pending.laneId, row: insertRow + 1 },
          selection: { lanes: [pending.laneId], steps: [createdId], connections: [], phases: [] },
        });
      }
      return createdId;
    },

    updateStep: (id, updates) => {
      commit((draft) => {
        const step = draft.steps.find((item) => item.id === id);
        if (!step) return;
        const previousLaneId = step.laneId;
        Object.assign(step, updates);
        step.width = updates.width ?? step.width;
        step.height = updates.height ?? step.height;
        if (typeof updates.order === 'number' && Number.isFinite(updates.order)) {
          step.order = Math.max(0, Math.round(updates.order));
        }
        if (updates.laneId && updates.laneId !== previousLaneId) {
          step.laneId = updates.laneId;
          const laneStepsWithoutCurrent = draft.steps.filter(
            (candidate) => candidate.laneId === step.laneId && candidate.id !== step.id
          );
          const occupied = new Set(laneStepsWithoutCurrent.map((candidate) => candidate.order));
          let desiredRow = step.order;
          while (occupied.has(desiredRow)) {
            desiredRow += 1;
          }
          step.order = desiredRow;
        }
        layoutLaneSteps(draft, step.laneId);
        if (previousLaneId !== step.laneId) {
          layoutLaneSteps(draft, previousLaneId);
        }
        sortSteps(draft);
      }, 'update step', {
        action: 'update_step',
        targetType: 'step',
        targetId: id,
        payload: updates,
      });
    },

    moveStep: (id, x, y) => {
      commit((draft) => {
        const existing = removeStepFromDiagram(draft, id);
        if (!existing) return;
        const previousLaneId = existing.laneId;
        const centerX = x + existing.width / 2;
        const centerY = y + existing.height / 2;
        const laneIndex =
          draft.orientation === 'horizontal'
            ? resolveLaneIndexByY(draft.lanes, centerY)
            : resolveLaneIndex(draft.lanes, centerX);
        const targetLane = draft.lanes[laneIndex] ?? draft.lanes.find((lane) => lane.id === previousLaneId);
        if (!targetLane) {
          draft.steps.push(existing);
          return;
        }
        existing.laneId = targetLane.id;
        const laneSteps = draft.steps.filter((step) => step.laneId === targetLane.id);
        const occupiedRows = new Set(laneSteps.map((step) => step.order));
        let desiredRow =
          draft.orientation === 'horizontal'
            ? Math.max(
                0,
                columnIndexFromX(x - HORIZONTAL_HEADER_WIDTH, existing.width)
              )
            : Math.max(0, rowIndexFromY(y, existing.height));
        while (occupiedRows.has(desiredRow)) {
          desiredRow += 1;
        }
        existing.order = desiredRow;
        layoutLaneSteps(draft, targetLane.id, [...laneSteps, existing]);
        draft.steps.push(existing);
        if (previousLaneId && previousLaneId !== targetLane.id) {
          layoutLaneSteps(draft, previousLaneId);
        }
        sortSteps(draft);
      }, 'move step', {
        action: 'move_step',
        targetType: 'step',
        targetId: id,
        payload: { x, y },
      });
    },

    reorderStep: (id, targetIndex) => {
      commit((draft) => {
        const step = draft.steps.find((item) => item.id === id);
        if (!step) return;
        const laneSteps = draft.steps
          .filter((candidate) => candidate.laneId === step.laneId)
          .sort((a, b) => a.order - b.order);
        const currentIndex = laneSteps.findIndex((candidate) => candidate.id === id);
        if (currentIndex === -1) return;
        const boundedIndex = Math.max(0, Math.min(targetIndex, laneSteps.length));
        laneSteps.splice(currentIndex, 1);
        laneSteps.splice(boundedIndex, 0, step);
        laneSteps.forEach((candidate, index) => {
          candidate.order = index;
        });
        layoutLaneSteps(draft, step.laneId, laneSteps);
        sortSteps(draft);
      }, 'reorder step', {
        action: 'reorder_step',
        targetType: 'step',
        targetId: id,
        payload: { targetIndex },
      });
    },

    moveStepUp: (id) => {
      commit((draft) => {
        const step = draft.steps.find((item) => item.id === id);
        if (!step) return;
        const laneSteps = draft.steps
          .filter((candidate) => candidate.laneId === step.laneId)
          .sort((a, b) => a.order - b.order);
        const index = laneSteps.findIndex((candidate) => candidate.id === id);
        if (index === -1) return;
        if (step.order <= 0 && index === 0) return;
        const previousOrder = step.order;
        const targetOrder = Math.max(0, previousOrder - 1);
        if (targetOrder === previousOrder) return;
        const occupant = laneSteps.find(
          (candidate) => candidate.id !== id && candidate.order === targetOrder
        );
        if (occupant) {
          occupant.order = previousOrder;
        }
        step.order = targetOrder;
        layoutLaneSteps(draft, step.laneId, laneSteps);
        sortSteps(draft);
      }, 'move step up', {
        action: 'move_step_up',
        targetType: 'step',
        targetId: id,
      });
    },

    moveStepDown: (id) => {
      commit((draft) => {
        const step = draft.steps.find((item) => item.id === id);
        if (!step) return;
        const laneSteps = draft.steps
          .filter((candidate) => candidate.laneId === step.laneId)
          .sort((a, b) => a.order - b.order);
        const index = laneSteps.findIndex((candidate) => candidate.id === id);
        if (index === -1) return;
        const previousOrder = step.order;
        const targetOrder = previousOrder + 1;
        const occupant = laneSteps.find(
          (candidate) => candidate.id !== id && candidate.order === targetOrder
        );
        if (occupant) {
          occupant.order = previousOrder;
        }
        step.order = targetOrder;
        layoutLaneSteps(draft, step.laneId, laneSteps);
        sortSteps(draft);
      }, 'move step down', {
        action: 'move_step_down',
        targetType: 'step',
        targetId: id,
      });
    },

    changeStepKind: (id, kind) => {
      commit((draft) => {
        const step = draft.steps.find((item) => item.id === id);
        if (!step) return;
        const dimensions = KIND_DIMENSIONS[kind];
        step.kind = kind;
        step.width = dimensions.width;
        step.height = dimensions.height;
        step.color = KIND_COLORS[kind];
        step.fillColor = KIND_FILL_COLORS[kind];
        layoutLaneSteps(draft, step.laneId);
        sortSteps(draft);
      }, 'change step kind', {
        action: 'change_step_kind',
        targetType: 'step',
        targetId: id,
        payload: { kind },
      });
    },

    removeStep: (id) => {
      commit((draft) => {
        const step = removeStepFromDiagram(draft, id);
        if (!step) return;
        draft.connections = draft.connections.filter(
          (connection) => connection.sourceId !== id && connection.targetId !== id
        );
        layoutLaneSteps(draft, step.laneId);
        sortSteps(draft);
      }, 'remove step', {
        action: 'remove_step',
        targetType: 'step',
        targetId: id,
      });
    },

    addConnection: (sourceId, targetId, sourceHandle, targetHandle) => {
      if (sourceId === targetId) return;
      commit((draft) => {
        const exists = draft.connections.some(
          (connection) =>
            connection.sourceId === sourceId &&
            connection.targetId === targetId &&
            (connection.sourceHandle ?? null) === (sourceHandle ?? null) &&
            (connection.targetHandle ?? null) === (targetHandle ?? null)
        );
        if (exists) return;
        draft.connections.push({
          id: nanoid(),
          sourceId,
          targetId,
          sourceHandle: sourceHandle ?? undefined,
          targetHandle: targetHandle ?? undefined,
          control: null,
          startMarker: 'none',
          endMarker: 'arrow',
          markerSize: 16,
          label: '',
        });
      }, 'add connection', {
        action: 'add_connection',
        targetType: 'connection',
        payload: { sourceId, targetId, sourceHandle, targetHandle },
      });
    },

    updateConnectionLabel: (connectionId, label) => {
      commit((draft) => {
        const connection = draft.connections.find((edge) => edge.id === connectionId);
        if (!connection) return;
        const trimmed = (label ?? '').toString().slice(0, 50);
        connection.label = trimmed;
      }, 'update connection label', {
        action: 'update_connection_label',
        targetType: 'connection',
        targetId: connectionId,
        payload: { label },
      });
    },

    updateConnectionMarker: (connectionId, updates) => {
      commit((draft) => {
        const connection = draft.connections.find((edge) => edge.id === connectionId);
        if (!connection) return;
        if (typeof updates.startMarker !== 'undefined') {
          connection.startMarker = updates.startMarker;
        }
        if (typeof updates.endMarker !== 'undefined') {
          connection.endMarker = updates.endMarker;
        }
        if (typeof updates.markerSize === 'number') {
          connection.markerSize = Math.max(4, Math.min(64, Math.round(updates.markerSize)));
        }
      }, 'update connection marker', {
        action: 'update_connection_marker',
        targetType: 'connection',
        targetId: connectionId,
        payload: updates,
      });
    },

    updateConnectionControl: (connectionId, control) => {
      commit((draft) => {
        const connection = draft.connections.find((edge) => edge.id === connectionId);
        if (!connection) return;
        connection.control = control ? { x: control.x, y: control.y } : null;
      }, 'update connection control', {
        action: 'update_connection_control',
        targetType: 'connection',
        targetId: connectionId,
        payload: control ? { x: control.x, y: control.y } : undefined,
      });
    },

    updateConnectionEndpoints: (connectionId, updates) => {
      commit((draft) => {
        const connection = draft.connections.find((edge) => edge.id === connectionId);
        if (!connection) return;

        const nextSourceId = updates.sourceId ?? connection.sourceId;
        const nextTargetId = updates.targetId ?? connection.targetId;

        if (!nextSourceId || !nextTargetId || nextSourceId === nextTargetId) {
          return;
        }

        const desiredSourceHandle =
          updates.sourceHandle !== undefined
            ? updates.sourceHandle ?? null
            : connection.sourceHandle ?? null;
        const desiredTargetHandle =
          updates.targetHandle !== undefined
            ? updates.targetHandle ?? null
            : connection.targetHandle ?? null;

        const duplicate = draft.connections.some(
          (edge) =>
            edge.id !== connectionId &&
            edge.sourceId === nextSourceId &&
            edge.targetId === nextTargetId &&
            (edge.sourceHandle ?? null) === desiredSourceHandle &&
            (edge.targetHandle ?? null) === desiredTargetHandle
        );
        if (duplicate) return;

        const endpointsChanged =
          nextSourceId !== connection.sourceId ||
          nextTargetId !== connection.targetId ||
          updates.sourceHandle !== undefined ||
          updates.targetHandle !== undefined;

        connection.sourceId = nextSourceId;
        connection.targetId = nextTargetId;
        connection.sourceHandle = desiredSourceHandle ?? undefined;
        connection.targetHandle = desiredTargetHandle ?? undefined;

        if (endpointsChanged) {
          connection.control = null;
        }
      }, 'update connection endpoints', {
        action: 'update_connection_endpoints',
        targetType: 'connection',
        targetId: connectionId,
        payload: updates,
      });
    },

    reverseConnection: (connectionId) => {
      commit((draft) => {
        const connection = draft.connections.find((edge) => edge.id === connectionId);
        if (!connection) return;

        const nextSourceId = connection.targetId;
        const nextTargetId = connection.sourceId;
        const convertHandle = (handle: string | undefined, kind: 'source' | 'target') => {
          if (!handle) return null;
          if (handle.endsWith('-source')) {
            return kind === 'source' ? handle : handle.replace(/-source$/, '-target');
          }
          if (handle.endsWith('-target')) {
            return kind === 'target' ? handle : handle.replace(/-target$/, '-source');
          }
          return handle;
        };

        const nextSourceHandle = convertHandle(connection.targetHandle, 'source');
        const nextTargetHandle = convertHandle(connection.sourceHandle, 'target');

        const duplicate = draft.connections.some(
          (edge) =>
            edge.id !== connectionId &&
            edge.sourceId === nextSourceId &&
            edge.targetId === nextTargetId &&
            (edge.sourceHandle ?? null) === nextSourceHandle &&
            (edge.targetHandle ?? null) === nextTargetHandle
        );
        if (duplicate) return;

        connection.sourceId = nextSourceId;
        connection.targetId = nextTargetId;
        connection.sourceHandle = nextSourceHandle ?? undefined;
        connection.targetHandle = nextTargetHandle ?? undefined;
        connection.control = connection.control ? { x: connection.control.x, y: connection.control.y } : null;
      }, 'reverse connection', {
        action: 'reverse_connection',
        targetType: 'connection',
        targetId: connectionId,
      });
    },

    removeConnection: (connectionId) => {
      commit((draft) => {
        draft.connections = draft.connections.filter((connection) => connection.id !== connectionId);
      }, 'remove connection', {
        action: 'remove_connection',
        targetType: 'connection',
        targetId: connectionId,
      });
    },

    shiftRows: (row, amount, options) => {
      const normalized = Math.max(0, Math.floor(amount));
      if (normalized <= 0) return;
      const { scope, laneId, direction = 'down' } = options;
      const laneIds = scope === 'all'
        ? get().diagram.lanes.map((lane) => lane.id)
        : laneId
        ? [laneId]
        : [];
      if (!laneIds.length) return;

      commit((draft) => {
        laneIds.forEach((targetLaneId) => {
          const lane = draft.lanes.find((candidate) => candidate.id === targetLaneId);
          if (!lane) return;
          const laneSteps = draft.steps
            .filter((step) => step.laneId === targetLaneId)
            .sort((a, b) => a.order - b.order);

          if (direction === 'down') {
            laneSteps
              .filter((step) => step.order >= row)
              .forEach((step) => {
                step.order += normalized;
              });
          } else {
            const movingSteps = laneSteps.filter((step) => step.order >= row);
            const staticSteps = laneSteps.filter((step) => step.order < row);
            const staticOrders = new Set(staticSteps.map((step) => step.order));
            const conflict = movingSteps.some((step) => {
              const candidate = Math.max(0, step.order - normalized);
              return staticOrders.has(candidate);
            });
            if (conflict) {
              return;
            }
            movingSteps.forEach((step) => {
              step.order = Math.max(0, step.order - normalized);
            });
          }

          layoutLaneSteps(draft, targetLaneId, laneSteps);
        });
        sortSteps(draft);
        draft.phaseGroups.forEach((phase) => {
          if (direction === 'down') {
            if (phase.startRow >= row) {
              phase.startRow += normalized;
              phase.endRow += normalized;
            } else if (phase.endRow >= row) {
              phase.endRow += normalized;
            }
          } else {
            if (phase.startRow >= row) {
              phase.startRow = Math.max(0, phase.startRow - normalized);
              phase.endRow = Math.max(phase.startRow, phase.endRow - normalized);
            } else if (phase.endRow >= row) {
              phase.endRow = Math.max(phase.startRow, phase.endRow - normalized);
            }
          }
        });
        draft.phaseGroups.sort((a, b) => a.startRow - b.startRow);
      }, direction === 'down' ? 'shift rows down' : 'shift rows up', {
        action: direction === 'down' ? 'shift_rows_down' : 'shift_rows_up',
        targetType: 'diagram',
        payload: { row, amount: normalized, scope, laneIds, direction },
      });

      const laneSet = new Set(laneIds);
      set((state) => {
        const current = state.pendingInsert;
        if (!current || !laneSet.has(current.laneId)) {
          return {};
        }
        const nextRow = direction === 'down'
          ? current.row + normalized
          : Math.max(0, current.row - normalized);
        return { pendingInsert: { laneId: current.laneId, row: nextRow } };
      });
    },

    setSelection: (selection) => {
      const lanes = selection.lanes ?? [];
      const steps = selection.steps ?? [];
      const connections = selection.connections ?? [];
      const phases = selection.phases ?? [];
      set((state) => ({
        selection: {
          lanes: [...lanes],
          steps: [...steps],
          connections: [...connections],
          phases: [...phases],
        },
        pendingInsert: steps.length === 0 && connections.length === 0 ? state.pendingInsert : null,
      }));
    },

    clearSelection: () => {
      set({ selection: { lanes: [], steps: [], connections: [], phases: [] }, pendingInsert: null });
    },

    setPendingInsert: (laneId, row) => {
      set({ pendingInsert: { laneId, row: Math.max(0, Math.floor(row)) } });
    },

    clearPendingInsert: () => {
      set({ pendingInsert: null });
    },
    addPhaseGroup: (startRow, endRow, title) => {
      const normalizedStart = Math.max(0, Math.min(startRow, endRow));
      const normalizedEnd = Math.max(normalizedStart, Math.max(startRow, endRow));
      let createdId = '';
      commit((draft) => {
        const id = nanoid();
        draft.phaseGroups.push({
          id,
          title,
          startRow: normalizedStart,
          endRow: normalizedEnd,
        });
        draft.phaseGroups.sort((a, b) => a.startRow - b.startRow);
        createdId = id;
      }, 'add phase');
      return createdId;
    },
    updatePhaseGroup: (id, updates) => {
      commit((draft) => {
        const target = draft.phaseGroups.find((phase) => phase.id === id);
        if (!target) return;
        if (typeof updates.startRow === 'number' || typeof updates.endRow === 'number') {
          const nextStart = typeof updates.startRow === 'number' ? updates.startRow : target.startRow;
          const nextEnd = typeof updates.endRow === 'number' ? updates.endRow : target.endRow;
          const normalizedStart = Math.max(0, Math.min(nextStart, nextEnd));
          const normalizedEnd = Math.max(normalizedStart, Math.max(nextStart, nextEnd));
          target.startRow = normalizedStart;
          target.endRow = normalizedEnd;
        }
        if (typeof updates.title === 'string') {
          target.title = updates.title;
        }
        draft.phaseGroups.sort((a, b) => a.startRow - b.startRow);
      }, 'update phase');
    },
    removePhaseGroup: (id) => {
      commit((draft) => {
        draft.phaseGroups = draft.phaseGroups.filter((phase) => phase.id !== id);
      }, 'remove phase');
    },
    requestScrollToTop: () => {
      set((state) => ({ scrollToTopCounter: state.scrollToTopCounter + 1 }));
    },

    undo: () => {
      const { undoStack, redoStack, diagram } = get();
      if (!undoStack.length) return;
      const entry = undoStack[undoStack.length - 1];
      const trimmedUndo = undoStack.slice(0, -1);
      const nextRedo = [...redoStack, { diagram: cloneDiagram(diagram), label: 'undo', timestamp: Date.now() }].slice(
        -HISTORY_LIMIT
      );
      set({
        diagram: { ...cloneDiagram(entry.diagram), updatedAt: new Date().toISOString() },
        undoStack: trimmedUndo,
        redoStack: nextRedo,
        canUndo: trimmedUndo.length > 0,
        canRedo: nextRedo.length > 0,
      });
      get().log({ action: 'undo', targetType: 'diagram' });
    },

    redo: () => {
      const { redoStack, undoStack, diagram } = get();
      if (!redoStack.length) return;
      const entry = redoStack[redoStack.length - 1];
      const trimmedRedo = redoStack.slice(0, -1);
      const nextUndo = [...undoStack, { diagram: cloneDiagram(diagram), label: 'redo', timestamp: Date.now() }].slice(
        -HISTORY_LIMIT
      );
      set({
        diagram: { ...cloneDiagram(entry.diagram), updatedAt: new Date().toISOString() },
        redoStack: trimmedRedo,
        undoStack: nextUndo,
        canUndo: nextUndo.length > 0,
        canRedo: trimmedRedo.length > 0,
      });
      get().log({ action: 'redo', targetType: 'diagram' });
    },

    reset: () => {
      const orientation = get().diagram.orientation ?? 'vertical';
      set({
        diagram: createEmptyDiagram(orientation),
        isOrientationCommitted: true,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        selection: { lanes: [], steps: [], connections: [], phases: [] },
        pendingInsert: null,
      });
      get().log({ action: 'reset', targetType: 'diagram' });
    },

    log: (entry) => {
      const { auditTrail } = get();
      const nextAudit: AuditEntry = {
        id: nanoid(),
        timestamp: Date.now(),
        ...entry,
      };
      set({ auditTrail: [...auditTrail, nextAudit] });
    },
  };
});
