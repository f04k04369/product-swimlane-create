import type { Lane, Step } from './types';

export const GRID_SIZE = 32;
export const LANE_WIDTH = 320;
export const LANE_GAP = 48;
export const LANE_PADDING = 80;
export const ROW_HEIGHT = 240;
export const LANE_COLUMN_HEIGHT = LANE_PADDING * 2 + ROW_HEIGHT;

const clampLaneIndex = (lanes: Lane[], index: number) => {
  if (!lanes.length) return 0;
  if (index < 0) return 0;
  if (index >= lanes.length) return lanes.length - 1;
  return index;
};

export const columnLeft = (order: number) => LANE_PADDING + order * (LANE_WIDTH + LANE_GAP);

export const laneCenter = (order: number) => columnLeft(order) + LANE_WIDTH / 2;

export const deriveLanePositionX = (order: number) => columnLeft(order);

export const deriveStepX = (order: number, stepWidth: number) =>
  columnLeft(order) + Math.max(0, (LANE_WIDTH - stepWidth) / 2);

export const rowIndexFromY = (value: number, stepHeight: number) => {
  const adjusted = value - LANE_PADDING + stepHeight / 2;
  if (adjusted <= 0) return 0;
  return Math.floor(adjusted / ROW_HEIGHT);
};

export const yForRow = (row: number, stepHeight: number) =>
  LANE_PADDING + row * ROW_HEIGHT + Math.max(0, (ROW_HEIGHT - stepHeight) / 2);

export const resolveLaneIndex = (lanes: Lane[], xCenter: number) => {
  if (!lanes.length) return 0;
  const base = laneCenter(0);
  const distance = xCenter - base;
  const approx = Math.round(distance / (LANE_WIDTH + LANE_GAP));
  return clampLaneIndex(lanes, approx);
};

export const computeLaneHeight = (laneSteps: Step[]): number => {
  const minHeight = LANE_PADDING * 2 + ROW_HEIGHT;
  if (!laneSteps.length) return minHeight;
  const maxRow = laneSteps.reduce((acc, step) => Math.max(acc, Math.max(0, Math.round(step.order))), 0);
  return Math.max(minHeight, LANE_PADDING * 2 + (maxRow + 1) * ROW_HEIGHT);
};
