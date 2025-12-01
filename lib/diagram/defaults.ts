import { nanoid } from 'nanoid/non-secure';
import type { Diagram, DiagramOrientation, Lane, Step } from './types';
import {
  COLUMN_WIDTH,
  HORIZONTAL_HEADER_WIDTH,
  LANE_PADDING,
  deriveLanePositionY,
  deriveStepX,
  horizontalColumnLeft,
  LANE_WIDTH,
  yForRow,
} from './layout';

export const STEP_DEFAULT_SIZE = { width: 240, height: 120 };

export const LANE_COLORS = ['#0ea5e9', '#22c55e', '#f97316', '#6366f1', '#ec4899'];

export const getLaneColor = (order: number) => LANE_COLORS[order % LANE_COLORS.length];

const createLane = (order: number, title: string): Lane => ({
  id: nanoid(),
  title,
  description: '',
  order,
  color: getLaneColor(order),
  width: LANE_WIDTH,
});

const createStep = (orientation: DiagramOrientation, lanes: Lane[], lane: Lane, title: string, index: number): Step => {
  const base: Step = {
    id: nanoid(),
    title,
    description: '',
    laneId: lane.id,
    order: index,
    x: 0,
    y: 0,
    width: STEP_DEFAULT_SIZE.width,
    height: STEP_DEFAULT_SIZE.height,
    color: '#000000',
    fillColor: '#e0ebff',
    kind: 'process',
  };
  if (orientation === 'horizontal') {
    const columnLeft = horizontalColumnLeft(index);
    const centeredOffset = Math.max(0, (COLUMN_WIDTH - base.width) / 2);
    base.x = HORIZONTAL_HEADER_WIDTH + LANE_PADDING + columnLeft + centeredOffset;
    const laneTop = deriveLanePositionY(lanes, lane.order);
    const laneThickness = lane.width;
    const verticalPadding = Math.max(0, (laneThickness - base.height) / 2);
    base.y = laneTop + verticalPadding;
  } else {
    base.x = deriveStepX(lanes, lane.order, base.width);
    base.y = yForRow(index, base.height);
  }
  return base;
};

export const createEmptyDiagram = (orientation: DiagramOrientation = 'vertical'): Diagram => {
  const now = new Date().toISOString();
  const lanes = [
    createLane(0, '企画'),
    createLane(1, '開発'),
    createLane(2, '運用'),
  ];
  const steps = lanes.map((lane) => createStep(orientation, lanes, lane, `タスク ${lane.order + 1}`, 0));

  return {
    id: nanoid(),
    title: '新規スイムレーン',
    orientation,
    lanes,
    steps,
    connections: [],
    phaseGroups: [],
    createdAt: now,
    updatedAt: now,
  };
};
