import type { Lane, Step } from './types';

export const GRID_SIZE = 32;
export const LANE_WIDTH = 320;
export const LANE_GAP = 0;
export const LANE_PADDING = 80;
export const ROW_HEIGHT = 240;
export const LANE_COLUMN_HEIGHT = LANE_PADDING * 2 + ROW_HEIGHT;

const clampLaneIndex = (lanes: Lane[], index: number) => {
  if (!lanes.length) return 0;
  if (index < 0) return 0;
  if (index >= lanes.length) return lanes.length - 1;
  return index;
};

const sortedByOrder = (lanes: Lane[]) => lanes.slice().sort((a, b) => a.order - b.order);

const laneWidthAt = (lanes: Lane[], order: number) => {
  const lane = lanes.find((l) => l.order === order);
  return lane?.width ?? LANE_WIDTH;
};

export const columnLeft = (lanes: Lane[], order: number) => {
  const ordered = sortedByOrder(lanes);
  let left = LANE_PADDING;
  for (const lane of ordered) {
    if (lane.order >= order) break;
    left += (lane.width ?? LANE_WIDTH) + LANE_GAP;
  }
  return left;
};

export const laneCenter = (lanes: Lane[], order: number) => columnLeft(lanes, order) + laneWidthAt(lanes, order) / 2;

export const deriveLanePositionX = (lanes: Lane[], order: number) => columnLeft(lanes, order);

export const deriveStepX = (lanes: Lane[], order: number, stepWidth: number) =>
  columnLeft(lanes, order) + Math.max(0, (laneWidthAt(lanes, order) - stepWidth) / 2);

export const rowIndexFromY = (value: number, stepHeight: number) => {
  const adjusted = value - LANE_PADDING + stepHeight / 2;
  if (adjusted <= 0) return 0;
  return Math.floor(adjusted / ROW_HEIGHT);
};

export const yForRow = (row: number, stepHeight: number) =>
  LANE_PADDING + row * ROW_HEIGHT + Math.max(0, (ROW_HEIGHT - stepHeight) / 2);

export const resolveLaneIndex = (lanes: Lane[], xCenter: number) => {
  if (!lanes.length) return 0;
  const ordered = sortedByOrder(lanes);
  let closestIndex = 0;
  let closestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ordered.length; i += 1) {
    const center = laneCenter(lanes, ordered[i].order);
    const dist = Math.abs(xCenter - center);
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex = i;
    }
  }
  return clampLaneIndex(ordered, closestIndex);
};

export const computeLaneHeight = (laneSteps: Step[]): number => {
  const minHeight = LANE_PADDING * 2 + ROW_HEIGHT;
  if (!laneSteps.length) return minHeight;
  const maxRow = laneSteps.reduce((acc, step) => Math.max(acc, Math.max(0, Math.round(step.order))), 0);
  return Math.max(minHeight, LANE_PADDING * 2 + (maxRow + 1) * ROW_HEIGHT);
};
