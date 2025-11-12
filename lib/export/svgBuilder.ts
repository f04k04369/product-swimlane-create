import { computeLaneHeight, deriveLanePositionX, LANE_PADDING, LANE_WIDTH, ROW_HEIGHT } from '@/lib/diagram/layout';
import type { Diagram, DiagramContentBounds, Step, Connection } from '@/lib/diagram/types';

interface BuildSvgOptions {
  bounds?: DiagramContentBounds | null;
  padding?: number;
  backgroundColor?: string;
  strokeColor?: string;
}

const DEFAULT_PADDING = 48;
const HEADER_HEIGHT = 40;
const LANE_HEADER_FILL = '#f1f5f9';
const LANE_BORDER_COLOR = '#cbd5f5';
const TEXT_COLOR = '#1f2933';
const STEP_TEXT_COLOR = '#1f2937';
const STEP_BORDER_COLOR = '#94a3b8';
const CONNECTION_COLOR = '#2563eb';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const resolveHandlePoint = (step: Step, handle: string | undefined) => {
  const x = step.x;
  const y = step.y;
  switch (handle) {
    case 'top':
      return { x: x + step.width / 2, y };
    case 'left':
      return { x, y: y + step.height / 2 };
    case 'right':
      return { x: x + step.width, y: y + step.height / 2 };
    case 'bottom':
    default:
      return { x: x + step.width / 2, y: y + step.height };
  }
};

const buildConnectionPath = (connection: Connection, stepMap: Map<string, Step>) => {
  const source = stepMap.get(connection.sourceId);
  const target = stepMap.get(connection.targetId);
  if (!source || !target) return null;

  const start = resolveHandlePoint(source, connection.sourceHandle);
  const end = resolveHandlePoint(target, connection.targetHandle);

  const control = connection.control ?? null;

  const points: Array<{ x: number; y: number }> = [];
  points.push({ x: start.x, y: start.y });

  if (control) {
    points.push({ x: control.x, y: start.y });
    points.push({ x: control.x, y: control.y });
    points.push({ x: end.x, y: control.y });
  } else {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    if (dx < dy) {
      const midY = (start.y + end.y) / 2;
      points.push({ x: start.x, y: midY });
      points.push({ x: end.x, y: midY });
    } else {
      const midX = (start.x + end.x) / 2;
      points.push({ x: midX, y: start.y });
      points.push({ x: midX, y: end.y });
    }
  }

  points.push({ x: end.x, y: end.y });

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const labelPoint = (() => {
    const idx = Math.floor(points.length / 2);
    const prev = points[idx - 1] ?? points[idx];
    const next = points[idx];
    return {
      x: (prev.x + next.x) / 2,
      y: (prev.y + next.y) / 2,
    };
  })();

  return {
    path,
    labelPoint,
    start,
    end,
  };
};

const DEFAULT_STEP_FILL: Record<string, string> = {
  process: '#ffffff',
  decision: '#e0eaff',
  start: '#ecfdf5',
  end: '#fef2f2',
  file: '#fff4ad',
};

const DEFAULT_STEP_BORDER: Record<string, string> = {
  process: STEP_BORDER_COLOR,
  decision: '#3b82f6',
  start: '#10b981',
  end: '#f97316',
  file: '#facc15',
};

const buildStepShape = (step: Step) => {
  const fill = step.fillColor ?? DEFAULT_STEP_FILL[step.kind] ?? DEFAULT_STEP_FILL.process;
  const stroke = DEFAULT_STEP_BORDER[step.kind] ?? STEP_BORDER_COLOR;

  switch (step.kind) {
    case 'decision': {
      const centerX = step.x + step.width / 2;
      const centerY = step.y + step.height / 2;
      const halfWidth = step.width / 2;
      const halfHeight = step.height / 2;
      return `<path d="${[
        `M ${centerX} ${centerY - halfHeight}`,
        `L ${centerX + halfWidth} ${centerY}`,
        `L ${centerX} ${centerY + halfHeight}`,
        `L ${centerX - halfWidth} ${centerY}`,
        'Z',
      ].join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    }
    case 'start':
    case 'end': {
      const rx = Math.min(step.width / 2, step.height / 2);
      const ry = step.height / 2;
      return `<rect x="${step.x}" y="${step.y}" width="${step.width}" height="${step.height}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    }
    case 'file': {
      const corner = Math.min(16, Math.min(step.width, step.height) / 3);
      const x = step.x;
      const y = step.y;
      const w = step.width;
      const h = step.height;
      return `<path d="M ${x} ${y} L ${x + w - corner} ${y} L ${x + w} ${y + corner} L ${x + w} ${y + h} L ${x} ${y + h} Z L ${x + w - corner} ${y} L ${x + w - corner} ${y + corner} L ${x + w} ${y + corner}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    }
    default:
      return `<rect x="${step.x}" y="${step.y}" width="${step.width}" height="${step.height}" rx="12" ry="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }
};

const buildStepText = (step: Step, padding = 12) => {
  const lines = [step.title || ''];
  if (step.description) {
    step.description.split('\n').forEach((line) => {
      lines.push(line);
    });
  }
  const startX = step.x + padding;
  const startY = step.y + padding + 14;

  let dy = 0;
  const tspan = lines
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const content = escapeXml(line);
      if (index === 0) {
        dy = 0;
        return `<tspan x="${startX}" y="${startY}">${content}</tspan>`;
      }
      dy += 16;
      return `<tspan x="${startX}" y="${startY + dy}">${content}</tspan>`;
    })
    .join('');

  return `<text font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="${STEP_TEXT_COLOR}">${tspan}</text>`;
};

const buildConnectionLabel = (connection: Connection, labelPoint: { x: number; y: number }) => {
  if (!connection.label) return '';
  const lines = connection.label.split('\n');
  const startX = labelPoint.x;
  const startY = labelPoint.y - (lines.length - 1) * 8;
  const tspans = lines
    .map((line, index) => {
      const content = escapeXml(line);
      return `<tspan x="${startX}" y="${startY + index * 16}">${content}</tspan>`;
    })
    .join('');

  return `<text font-family="Helvetica, Arial, sans-serif" font-size="12" text-anchor="middle" fill="${TEXT_COLOR}">${tspans}</text>`;
};

const computeDiagramBounds = (diagram: Diagram): DiagramContentBounds => {
  if (!diagram.lanes.length) {
    return {
      minX: 0,
      minY: 0,
      width: 1024,
      height: 768,
    };
  }

  const sorted = [...diagram.lanes].sort((a, b) => a.order - b.order);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const laneLeft = deriveLanePositionX(sorted, first.order) - LANE_PADDING;
  const laneRight =
    deriveLanePositionX(sorted, last.order) + ((last.width ?? LANE_WIDTH) || LANE_WIDTH) + LANE_PADDING;

  const stepsBottom = diagram.steps.length
    ? Math.max(...diagram.steps.map((step) => step.y + step.height))
    : ROW_HEIGHT + LANE_PADDING * 2;

  return {
    minX: Math.min(laneLeft, 0),
    minY: 0,
    width: Math.max(0, laneRight - Math.min(laneLeft, 0)),
    height: Math.max(stepsBottom + LANE_PADDING, ROW_HEIGHT + LANE_PADDING * 2),
  };
};

export const buildDiagramSvg = (diagram: Diagram, options: BuildSvgOptions = {}) => {
  const padding = options.padding ?? DEFAULT_PADDING;
  const bounds = options.bounds ?? computeDiagramBounds(diagram);
  const background = options.backgroundColor ?? '#ffffff';
  const strokeColor = options.strokeColor ?? LANE_BORDER_COLOR;

  const boundsMaxX = bounds.minX + bounds.width;
  const boundsMaxY = bounds.minY + bounds.height;

  const exportWidth = Math.max(1, Math.round(bounds.width + padding * 2));
  const exportHeight = Math.max(1, Math.round(bounds.height + padding * 2));

  const shiftX = (value: number) => value - bounds.minX + padding;
  const shiftY = (value: number) => value - bounds.minY + padding;

  const svgParts: string[] = [];

  svgParts.push('<?xml version="1.0" encoding="UTF-8"?>');
  svgParts.push('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">');
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}" preserveAspectRatio="xMidYMid meet">`
  );
  svgParts.push(`<rect x="0" y="0" width="100%" height="100%" fill="${background}"/>`);

  svgParts.push('<defs>');
  svgParts.push(
    `<marker id="arrow-end" markerWidth="12" markerHeight="12" refX="12" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L12 6 L0 12 Z" fill="${CONNECTION_COLOR}"/></marker>`
  );
  svgParts.push('</defs>');

  const orderedLanes = [...diagram.lanes].sort((a, b) => a.order - b.order);
  const laneHeights = new Map<string, number>();

  orderedLanes.forEach((lane) => {
    const laneSteps = diagram.steps.filter((step) => step.laneId === lane.id);
    laneHeights.set(lane.id, computeLaneHeight(laneSteps));
  });

  orderedLanes.forEach((lane) => {
    const laneWidth = lane.width ?? LANE_WIDTH;
    const laneHeight = laneHeights.get(lane.id) ?? ROW_HEIGHT + LANE_PADDING * 2;
    const laneX = shiftX(deriveLanePositionX(orderedLanes, lane.order));
    const laneY = shiftY(0);

    svgParts.push(
      `<rect x="${laneX}" y="${laneY}" width="${laneWidth}" height="${laneHeight}" fill="#ffffff" stroke="${strokeColor}" stroke-width="1.5"/>`
    );
    svgParts.push(
      `<rect x="${laneX}" y="${laneY}" width="${laneWidth}" height="${HEADER_HEIGHT}" fill="${LANE_HEADER_FILL}" stroke="${strokeColor}" stroke-width="1.5"/>`
    );

    const title = escapeXml(lane.title || 'Lane');
    const textX = laneX + laneWidth / 2;
    const textY = laneY + HEADER_HEIGHT / 2 + 5;
    svgParts.push(
      `<text x="${textX}" y="${textY}" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="${TEXT_COLOR}" text-anchor="middle">${title}</text>`
    );
  });

  const adjustedSteps: Step[] = diagram.steps
    .filter((step) => {
      const intersectsX = step.x + step.width >= bounds.minX && step.x <= boundsMaxX;
      const intersectsY = step.y + step.height >= bounds.minY && step.y <= boundsMaxY;
      return intersectsX && intersectsY;
    })
    .map((step) => ({
      ...step,
      x: shiftX(step.x),
      y: shiftY(step.y),
    }));
  const stepMap = new Map<string, Step>();
  adjustedSteps.forEach((step) => stepMap.set(step.id, step));

  adjustedSteps.forEach((step) => {
    svgParts.push(buildStepShape(step));
    svgParts.push(buildStepText(step));
  });

  diagram.connections.forEach((connection) => {
    const adjustedConnection: Connection = {
      ...connection,
      control: connection.control
        ? {
            x: shiftX(connection.control.x),
            y: shiftY(connection.control.y),
          }
        : null,
    };

    const pathData = buildConnectionPath(adjustedConnection, stepMap);
    if (!pathData) return;

    svgParts.push(
      `<path d="${pathData.path}" fill="none" stroke="${CONNECTION_COLOR}" stroke-width="2" marker-end="url(#arrow-end)" stroke-linecap="round" stroke-linejoin="round"/>`
    );

    const label = buildConnectionLabel(connection, {
      x: pathData.labelPoint.x,
      y: pathData.labelPoint.y - 8,
    });
    if (label) {
      svgParts.push(label);
    }
  });

  svgParts.push('</svg>');

  return svgParts.join('\n');
};


