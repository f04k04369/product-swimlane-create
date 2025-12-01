import type { Lane, Step } from './types';

export const GRID_SIZE = 32;
export const LANE_WIDTH = 320;
export const LANE_GAP = 0;
export const LANE_PADDING = 80;
export const ROW_HEIGHT = 240;
export const LANE_COLUMN_HEIGHT = LANE_PADDING * 2 + ROW_HEIGHT;
export const COLUMN_WIDTH = 240;
export const HORIZONTAL_HEADER_WIDTH = 200;
export const HORIZONTAL_STEP_GAP = 160;

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

const laneThicknessAt = (lanes: Lane[], order: number) => laneWidthAt(lanes, order);

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

export const deriveLanePositionY = (lanes: Lane[], order: number) => {
  const ordered = sortedByOrder(lanes);
  let top = LANE_PADDING;
  for (const lane of ordered) {
    if (lane.order >= order) break;
    top += laneThicknessAt(lanes, lane.order) + LANE_GAP;
  }
  return top;
};

export const columnLeftAt = (column: number) => LANE_PADDING + column * COLUMN_WIDTH;

export const HORIZONTAL_COLUMN_WIDTH = 120; // COLUMN_WIDTH / 2

export const horizontalColumnLeft = (column: number) => column * HORIZONTAL_COLUMN_WIDTH;

export const xForColumn = (column: number, stepWidth: number) =>
  columnLeftAt(column) + Math.max(0, (COLUMN_WIDTH - stepWidth) / 2);

export const columnIndexFromX = (value: number, stepWidth: number) => {
  const stride = HORIZONTAL_COLUMN_WIDTH;
  const adjusted = value - LANE_PADDING + stepWidth / 2;
  if (adjusted <= 0) return 0;
  return Math.floor(adjusted / stride);
};

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

export const resolveLaneIndexByY = (lanes: Lane[], yCenter: number) => {
  if (!lanes.length) return 0;
  const ordered = sortedByOrder(lanes);
  let closestIndex = 0;
  let closestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ordered.length; i += 1) {
    const lane = ordered[i];
    const top = deriveLanePositionY(lanes, lane.order);
    const thickness = laneThicknessAt(lanes, lane.order);
    const center = top + thickness / 2;
    const dist = Math.abs(yCenter - center);
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

export const computeLaneWidth = (laneSteps: Step[]): number => {
  const minWidth = LANE_PADDING * 2 + COLUMN_WIDTH;
  if (!laneSteps.length) return minWidth;
  const maxColumn = laneSteps.reduce((acc, step) => Math.max(acc, Math.max(0, Math.round(step.order))), 0);
  return Math.max(minWidth, LANE_PADDING * 2 + (maxColumn + 1) * COLUMN_WIDTH);
};

export const computeHorizontalLaneWidth = (laneSteps: Step[]): number => {
  const stride = HORIZONTAL_COLUMN_WIDTH;
  const minWidth = LANE_PADDING * 2 + COLUMN_WIDTH; // Ensure at least one full column width
  if (!laneSteps.length) return minWidth;
  const maxColumn = laneSteps.reduce((acc, step) => Math.max(acc, Math.max(0, Math.round(step.order))), 0);
  const lastStart = horizontalColumnLeft(maxColumn);
  return Math.max(minWidth, LANE_PADDING * 2 + lastStart + COLUMN_WIDTH);
};
