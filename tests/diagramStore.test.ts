import { beforeEach, describe, expect, it } from 'vitest';
import { useDiagramStore } from '@/state/useDiagramStore';
import { createEmptyDiagram } from '@/lib/diagram/defaults';

const resetStore = () => {
  const initial = createEmptyDiagram();
  useDiagramStore.setState({
    diagram: initial,
    selection: { lanes: [], steps: [], connections: [] },
    auditTrail: [],
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  });
};

describe('useDiagramStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('adds a lane and maintains order', () => {
    const { addLane, diagram } = useDiagramStore.getState();
    const initialCount = diagram.lanes.length;
    addLane('テストレーン');
    const nextState = useDiagramStore.getState();

    expect(nextState.diagram.lanes.length).toBe(initialCount + 1);
    const lastLane = nextState.diagram.lanes.at(-1);
    expect(lastLane?.title).toBe('テストレーン');
    expect(lastLane?.order).toBe(initialCount);
  });

  it('adds a step within selected lane', () => {
    const store = useDiagramStore.getState();
    const targetLane = store.diagram.lanes[0];
    store.addStep(targetLane.id, { title: 'ステップA', kind: 'process' });
    const { diagram } = useDiagramStore.getState();

    const stepsInLane = diagram.steps.filter((step) => step.laneId === targetLane.id);
    expect(stepsInLane.some((step) => step.title === 'ステップA')).toBe(true);
  });

  it('supports undo after lane removal', () => {
    const store = useDiagramStore.getState();
    const laneId = store.diagram.lanes[0].id;
    store.removeLane(laneId);
    expect(useDiagramStore.getState().diagram.lanes.some((lane) => lane.id === laneId)).toBe(false);

    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().diagram.lanes.some((lane) => lane.id === laneId)).toBe(true);
  });

  it('changes step kind and reorders rows', () => {
    const store = useDiagramStore.getState();
    const laneId = store.diagram.lanes[0].id;
    store.addStep(laneId, { title: 'B', kind: 'process' });
    const { diagram } = useDiagramStore.getState();
    const stepId = diagram.steps.find((step) => step.title === 'B')?.id;
    expect(stepId).toBeDefined();
    if (!stepId) return;

    store.changeStepKind(stepId, 'decision');
    const updated = useDiagramStore.getState().diagram.steps.find((step) => step.id === stepId);
    expect(updated?.kind).toBe('decision');

    store.moveStepUp(stepId);
    const laneSteps = useDiagramStore
      .getState()
      .diagram.steps
      .filter((step) => step.laneId === laneId)
      .sort((a, b) => a.order - b.order);
    expect(laneSteps[0]?.id).toBe(stepId);
  });
});
