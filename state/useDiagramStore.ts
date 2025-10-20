import { create } from 'zustand';
import { nanoid } from 'nanoid/non-secure';
import { createEmptyDiagram, getLaneColor, STEP_DEFAULT_SIZE } from '@/lib/diagram/defaults';
import { deriveStepX, resolveLaneIndex, rowIndexFromY, yForRow } from '@/lib/diagram/layout';
import type {
  AuditEntry,
  Diagram,
  DiagramHistoryEntry,
  ElementID,
  Lane,
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
  process: '#1f2937',
  decision: '#9333ea',
  start: '#16a34a',
  end: '#dc2626',
  file: '#0ea5e9',
};

interface DiagramStore {
  diagram: Diagram;
  selection: SelectionState;
  auditTrail: AuditEntry[];
  undoStack: DiagramHistoryEntry[];
  redoStack: DiagramHistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  setDiagram: (diagram: Diagram, options?: { label?: string; preserveLayout?: boolean }) => void;
  addLane: (title?: string) => void;
  updateLane: (id: ElementID, updates: LaneUpdate) => void;
  removeLane: (id: ElementID) => void;
  addStep: (laneId: ElementID, options?: { title?: string; kind?: StepKind }) => void;
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
  setSelection: (selection: SelectionState) => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  log: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
}

const cloneDiagram = (diagram: Diagram): Diagram => structuredClone(diagram);

const layoutLaneSteps = (
  diagram: Diagram,
  laneId: ElementID,
  providedSteps?: Step[]
) => {
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
      step.x = deriveStepX(lane.order, step.width);
      step.y = yForRow(row, step.height);
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
    diagram: createEmptyDiagram(),
    selection: { lanes: [], steps: [], connections: [] },
    auditTrail: [],
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,

    setDiagram: (diagram, options) => {
      const { label = 'import diagram', preserveLayout = false } = options ?? {};
      const snapshot = cloneDiagram(diagram);
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
          color: step.color ?? '#1f2937',
          x:
            preserveLayout && typeof step.x === 'number'
              ? step.x
              : targetLane
              ? deriveStepX(targetLane.order, width)
              : step.x,
          y:
            preserveLayout && typeof step.y === 'number'
              ? step.y
              : yForRow(order, height),
        };
      });
      if (!preserveLayout) {
        recalcAllLaneLayouts(snapshot);
      }
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
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        selection: { lanes: [], steps: [], connections: [] },
      });
      get().log({ action: label, targetType: 'diagram', targetId: snapshot.id });
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
        });
        draft.lanes = draft.lanes.map((lane, index) => ({
          ...lane,
          order: index,
          color: getLaneColor(index),
        }));
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
        Object.assign(lane, updates);
        if (typeof updates.order === 'number') {
          draft.lanes = draft.lanes
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((laneItem, index) => ({
              ...laneItem,
              order: index,
              color: getLaneColor(index),
            }));
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
        draft.lanes = draft.lanes
          .filter((lane) => lane.id !== id)
          .map((lane, index) => ({
            ...lane,
            order: index,
            color: getLaneColor(index),
          }));
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
        draft.lanes = sorted.map((item, index) => ({
          ...item,
          order: index,
          color: getLaneColor(index),
        }));
        recalcAllLaneLayouts(draft);
        sortSteps(draft);
      }, 'reorder lane', {
        action: 'reorder_lane',
        targetType: 'lane',
        targetId: id,
        payload: { newOrder },
      });
    },

    addStep: (laneId, options) => {
      const { title = '新しいステップ', kind = 'process' } = options ?? {};
      commit((draft) => {
        const lane = draft.lanes.find((item) => item.id === laneId);
        if (!lane) return;
        const dimensions = KIND_DIMENSIONS[kind];
        const occupiedRows = new Set(
          draft.steps.filter((candidate) => candidate.laneId === laneId).map((candidate) => candidate.order)
        );
        let order = 0;
        while (occupiedRows.has(order)) {
          order += 1;
        }
        const step: Step = {
          id: nanoid(),
          laneId,
          title,
          description: '',
          order,
          x: deriveStepX(lane.order, dimensions.width),
          y: yForRow(order, dimensions.height),
          width: dimensions.width,
          height: dimensions.height,
          color: KIND_COLORS[kind],
          kind,
        };
        draft.steps.push(step);
        layoutLaneSteps(draft, laneId);
        sortSteps(draft);
      }, 'add step', {
        action: 'add_step',
        targetType: 'step',
        payload: { laneId, kind },
      });
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
        const laneIndex = resolveLaneIndex(draft.lanes, centerX);
        const targetLane = draft.lanes[laneIndex] ?? draft.lanes.find((lane) => lane.id === previousLaneId);
        if (!targetLane) {
          draft.steps.push(existing);
          return;
        }
        existing.laneId = targetLane.id;
        const laneSteps = draft.steps.filter((step) => step.laneId === targetLane.id);
        const occupiedRows = new Set(laneSteps.map((step) => step.order));
        let desiredRow = Math.max(0, rowIndexFromY(y, existing.height));
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
        payload: control ?? null,
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

    setSelection: (selection) => {
      const lanes = selection.lanes ?? [];
      const steps = selection.steps ?? [];
      const connections = selection.connections ?? [];
      set({
        selection: {
          lanes: [...lanes],
          steps: [...steps],
          connections: [...connections],
        },
      });
    },

    clearSelection: () => {
      set({ selection: { lanes: [], steps: [], connections: [] } });
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
      set({
        diagram: createEmptyDiagram(),
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        selection: { lanes: [], steps: [], connections: [] },
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
