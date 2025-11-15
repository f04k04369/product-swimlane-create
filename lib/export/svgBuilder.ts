import { computeLaneHeight, deriveLanePositionX, LANE_PADDING, LANE_WIDTH, ROW_HEIGHT } from '@/lib/diagram/layout';
import type { Diagram, DiagramContentBounds, Step, Connection } from '@/lib/diagram/types';
import { hexToRgb, mixRgb, rgbToCss, rgbaToCss, getContrastingTextColor } from '@/components/canvas/laneColors';

interface BuildSvgOptions {
  bounds?: DiagramContentBounds | null;
  padding?: number;
  backgroundColor?: string;
}

const DEFAULT_PADDING = 48;
const HEADER_HEIGHT = 40;
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

type HandlePosition = 'Left' | 'Right' | 'Top' | 'Bottom';

const getHandlePosition = (handle: string | undefined): HandlePosition | null => {
  if (!handle) return null;
  const lower = handle.toLowerCase();
  if (lower.includes('left')) return 'Left';
  if (lower.includes('right')) return 'Right';
  if (lower.includes('top')) return 'Top';
  if (lower.includes('bottom')) return 'Bottom';
  if (lower === 'left') return 'Left';
  if (lower === 'right') return 'Right';
  if (lower === 'top') return 'Top';
  if (lower === 'bottom') return 'Bottom';
  return null;
};

const resolveHandlePoint = (step: Step, handle: string | undefined) => {
  const left = step.x;
  const top = step.y;
  const centerX = left + step.width / 2;
  const offsetY = top + step.height * 0.6;

  const position = getHandlePosition(handle);

  switch (position) {
    case 'Top':
      return { x: centerX, y: top };
    case 'Bottom':
      return { x: centerX, y: top + step.height };
    case 'Left':
      return { x: left, y: offsetY };
    case 'Right':
      return { x: left + step.width, y: offsetY };
    default:
      return { x: centerX, y: top + step.height };
  }
};

const buildConnectionPath = (connection: Connection, stepMap: Map<string, Step>) => {
  const source = stepMap.get(connection.sourceId);
  const target = stepMap.get(connection.targetId);
  if (!source || !target) return null;

  const start = resolveHandlePoint(source, connection.sourceHandle);
  const end = resolveHandlePoint(target, connection.targetHandle);

  const sourcePosition = getHandlePosition(connection.sourceHandle) ?? 'Bottom';
  const targetPosition = getHandlePosition(connection.targetHandle) ?? 'Top';
  const control = connection.control ?? null;

  const ALIGN_TOLERANCE = 6;
  const sameColumn = Math.abs(start.x - end.x) <= ALIGN_TOLERANCE;
  const sameRow = Math.abs(start.y - end.y) <= ALIGN_TOLERANCE;
  const horizontalFirst = sourcePosition === 'Left' || sourcePosition === 'Right';
  const horizontalLast = targetPosition === 'Left' || targetPosition === 'Right';

  const buildPoints = (): Array<{ x: number; y: number }> => {
    if (control) {
      const midX = control.x;
      const midY = control.y;
      return [
        { x: start.x, y: start.y },
        { x: midX, y: start.y },
        { x: midX, y: midY },
        { x: end.x, y: midY },
        { x: end.x, y: end.y },
      ];
    }

    const corners: Array<{ x: number; y: number }> = [];
    if (!(sameColumn || sameRow)) {
      if (horizontalFirst && horizontalLast) {
        const midX = start.x + (end.x - start.x) / 2;
        corners.push({ x: midX, y: start.y });
        corners.push({ x: midX, y: end.y });
      } else if (horizontalFirst) {
        corners.push({ x: end.x, y: start.y });
      } else if (horizontalLast) {
        corners.push({ x: start.x, y: end.y });
      } else {
        const midY = start.y + (end.y - start.y) / 2;
        corners.push({ x: start.x, y: midY });
        corners.push({ x: end.x, y: midY });
      }
    }

    return [{ x: start.x, y: start.y }, ...corners, { x: end.x, y: end.y }];
  };

  const points = buildPoints();

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const computePolylineMidpoint = (polyline: Array<{ x: number; y: number }>) => {
    if (polyline.length <= 2) {
      const startPoint = polyline[0];
      const endPoint = polyline.at(-1) ?? startPoint;
      return {
        x: (startPoint.x + endPoint.x) / 2,
        y: (startPoint.y + endPoint.y) / 2,
      };
    }

    let total = 0;
    const segments: Array<{ length: number; start: { x: number; y: number }; end: { x: number; y: number } }> = [];
    for (let i = 0; i < polyline.length - 1; i += 1) {
      const startPoint = polyline[i];
      const endPoint = polyline[i + 1];
      const length = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
      total += length;
      segments.push({ length, start: startPoint, end: endPoint });
    }

    if (total === 0) {
      const firstPoint = polyline[0];
      return { x: firstPoint.x, y: firstPoint.y };
    }

    let distance = total / 2;
    for (const seg of segments) {
      if (distance <= seg.length) {
        const ratio = distance / seg.length;
        return {
          x: seg.start.x + (seg.end.x - seg.start.x) * ratio,
          y: seg.start.y + (seg.end.y - seg.start.y) * ratio,
        };
      }
      distance -= seg.length;
    }

    const lastSeg = segments.at(-1);
    return lastSeg ? { x: lastSeg.end.x, y: lastSeg.end.y } : polyline[0];
  };

  const labelPoint = computePolylineMidpoint(points);

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

const DESCRIPTION_TEXT_COLOR = '#64748b';

const buildStepText = (step: Step) => {
  const centerX = step.x + step.width / 2;
  
  // 改行文字列（\n）を実際の改行文字に変換してから分割
  const normalizeNewlines = (text: string): string => {
    return text.replace(/\\n/g, '\n').replace(/\\r\\n/g, '\r\n').replace(/\\r/g, '\r');
  };
  
  const normalizedTitle = step.title && step.title.length > 0 ? normalizeNewlines(step.title) : '';
  const normalizedDescription = step.description ? normalizeNewlines(step.description) : '';
  
  const titleLines = normalizedTitle ? normalizedTitle.split(/\r?\n/) : ['無題のステップ'];
  const descriptionLines = normalizedDescription ? normalizedDescription.split(/\r?\n/) : [];

  type LineMeta = {
    rawText: string;
    fontSize: number;
    fontWeight: number;
    color: string;
  };

  const lineMetas: LineMeta[] = [];

  titleLines.forEach((line) => {
    lineMetas.push({
      rawText: line,
      fontSize: 14,
      fontWeight: 600,
      color: step.color ?? STEP_TEXT_COLOR,
    });
  });

  descriptionLines.forEach((line) => {
    lineMetas.push({
      rawText: line,
      fontSize: 12,
      fontWeight: 400,
      color: DESCRIPTION_TEXT_COLOR,
    });
  });

  const lineSpacing = 8;
  const totalHeight = lineMetas.reduce(
    (acc, meta, index) => acc + meta.fontSize + (index > 0 ? lineSpacing : 0),
    0
  );

  let currentY = step.y + step.height / 2 - totalHeight / 2;
  const texts: string[] = [];

  lineMetas.forEach((meta, index) => {
    currentY += meta.fontSize / 2;
    const y = currentY;
    currentY += meta.fontSize / 2;
    if (index < lineMetas.length - 1) {
      currentY += lineSpacing;
    }

    const content = meta.rawText.length > 0 ? escapeXml(meta.rawText) : '&#160;';

    texts.push(
      `<text x="${centerX}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${meta.fontSize}" font-weight="${meta.fontWeight}" fill="${meta.color}" text-anchor="middle" dominant-baseline="middle">${content}</text>`
    );
  });

  return texts.join('\n');
};

const buildConnectionLabel = (connection: Connection, labelPoint: { x: number; y: number }) => {
  if (!connection.label) return '';
  // 改行文字列（\n）を実際の改行文字に変換してから分割
  const normalizeNewlines = (text: string): string => {
    return text.replace(/\\n/g, '\n').replace(/\\r\\n/g, '\r\n').replace(/\\r/g, '\r');
  };
  const normalizedLabel = normalizeNewlines(connection.label);
  const lines = normalizedLabel.split(/\r?\n/);
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

    // レーンの背景色を計算（LaneNode.tsxと同じロジック）
    const baseColor = hexToRgb(lane.color);
    const laneFillColor = mixRgb(baseColor, { r: 255, g: 255, b: 255 }, 0.9);
    const laneBorderTint = mixRgb(baseColor, { r: 148, g: 163, b: 184 }, 0.55);
    const headerFillColor = mixRgb(baseColor, { r: 255, g: 255, b: 255 }, 0.7);
    const headerTextColor = getContrastingTextColor(headerFillColor);

    // レーン本体の背景（85%の不透明度）
    const laneFillRgba = rgbaToCss(laneFillColor, 0.85);
    // ボーダー色（60%の不透明度）
    const borderRgba = rgbaToCss(laneBorderTint, 0.6);
    // ヘッダーの背景色（100%の不透明度）
    const headerFillRgb = rgbToCss(headerFillColor);

    svgParts.push(
      `<rect x="${laneX}" y="${laneY}" width="${laneWidth}" height="${laneHeight}" fill="${laneFillRgba}" stroke="${borderRgba}" stroke-width="1.5"/>`
    );
    svgParts.push(
      `<rect x="${laneX}" y="${laneY}" width="${laneWidth}" height="${HEADER_HEIGHT}" fill="${headerFillRgb}" stroke="${borderRgba}" stroke-width="1.5"/>`
    );

    const title = escapeXml(lane.title || 'Lane');
    const textX = laneX + laneWidth / 2;
    const textY = laneY + HEADER_HEIGHT / 2 + 5;
    svgParts.push(
      `<text x="${textX}" y="${textY}" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="${headerTextColor}" text-anchor="middle">${title}</text>`
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


