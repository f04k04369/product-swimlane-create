import { nanoid } from 'nanoid/non-secure';
import type { Diagram, Lane, Step } from './types';
import { deriveStepX, yForRow } from './layout';

export const STEP_DEFAULT_SIZE = { width: 240, height: 120 };

export const LANE_COLORS = ['#0ea5e9', '#22c55e', '#f97316', '#6366f1', '#ec4899'];

export const getLaneColor = (order: number) => LANE_COLORS[order % LANE_COLORS.length];

const createLane = (order: number, title: string): Lane => ({
  id: nanoid(),
  title,
  description: '',
  order,
  color: getLaneColor(order),
});

const createStep = (lane: Lane, title: string, index: number): Step => ({
  id: nanoid(),
  title,
  description: '',
  laneId: lane.id,
  order: index,
  x: deriveStepX(lane.order, STEP_DEFAULT_SIZE.width),
  y: yForRow(index, STEP_DEFAULT_SIZE.height),
  width: STEP_DEFAULT_SIZE.width,
  height: STEP_DEFAULT_SIZE.height,
  color: '#1f2937',
  kind: 'process',
});

export const createEmptyDiagram = (): Diagram => {
  const now = new Date().toISOString();
  const lanes = [
    createLane(0, '企画'),
    createLane(1, '開発'),
    createLane(2, '運用'),
  ];
  const steps = lanes.map((lane) => createStep(lane, `タスク ${lane.order + 1}`, 0));

  return {
    id: nanoid(),
    title: '新規スイムレーン',
    lanes,
    steps,
    connections: [],
    createdAt: now,
    updatedAt: now,
  };
};
