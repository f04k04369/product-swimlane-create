import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BaseEdge, EdgeLabelRenderer, Position, useReactFlow, type EdgeProps } from 'reactflow';
import { useDiagramStore } from '@/state/useDiagramStore';
import { GRID_SIZE } from '@/lib/diagram/layout';
import type { MarkerKind } from '@/lib/diagram/types';

export type KeyEdgeData = {
  label?: string;
  control?: { x: number; y: number } | null;
  startMarker?: MarkerKind;
  endMarker?: MarkerKind;
  markerSize?: number;
};

export const KeyEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    selected,
    data,
  }: EdgeProps<KeyEdgeData>) => {
    const strokeColor = (style?.stroke as string | undefined) ?? '#2563eb';
    const strokeWidth = selected ? 3 : (style?.strokeWidth as number | undefined) ?? 2;
    const controlData = data?.control ?? null;
    const startMarkerKind: MarkerKind = data?.startMarker ?? 'none';
    const endMarkerKind: MarkerKind = data?.endMarker ?? 'arrow';
    const markerSize = Math.max(4, Math.min(64, data?.markerSize ?? 16));

    const reactFlow = useReactFlow();
    const updateConnectionControl = useDiagramStore((state) => state.updateConnectionControl);
    const [draggingControl, setDraggingControl] = useState(false);

    const buildPath = () => {
      const normalizedSource = sourcePosition ?? Position.Bottom;
      const normalizedTarget = targetPosition ?? Position.Top;
      const ALIGN_TOLERANCE = 6;
      const sameColumn = Math.abs(sourceX - targetX) <= ALIGN_TOLERANCE;
      const sameRow = Math.abs(sourceY - targetY) <= ALIGN_TOLERANCE;
      const horizontalFirst = normalizedSource === Position.Left || normalizedSource === Position.Right;
      const horizontalLast = normalizedTarget === Position.Left || normalizedTarget === Position.Right;

      const buildPoints = (): Array<{ x: number; y: number }> => {
        if (controlData) {
          const midX = controlData.x;
          const midY = controlData.y;
          return [
            { x: sourceX, y: sourceY },
            { x: midX, y: sourceY },
            { x: midX, y: midY },
            { x: targetX, y: midY },
            { x: targetX, y: targetY },
          ];
        }

        const corners: Array<{ x: number; y: number }> = [];

        if (!(sameColumn || sameRow)) {
          if (horizontalFirst && horizontalLast) {
            const midX = sourceX + (targetX - sourceX) / 2;
            corners.push({ x: midX, y: sourceY });
            corners.push({ x: midX, y: targetY });
          } else if (horizontalFirst) {
            corners.push({ x: targetX, y: sourceY });
          } else if (horizontalLast) {
            corners.push({ x: sourceX, y: targetY });
          } else {
            const midY = sourceY + (targetY - sourceY) / 2;
            corners.push({ x: sourceX, y: midY });
            corners.push({ x: targetX, y: midY });
          }
        }

        return [
          { x: sourceX, y: sourceY },
          ...corners,
          { x: targetX, y: targetY },
        ];
      };

        const points = buildPoints();

        const computePolylineMidpoint = (polyline: Array<{ x: number; y: number }>) => {
          if (polyline.length <= 2) {
            const start = polyline[0];
            const end = polyline.at(-1) ?? start;
            return {
              x: (start.x + end.x) / 2,
              y: (start.y + end.y) / 2,
            };
          }
          let total = 0;
          const segments: Array<{ length: number; start: { x: number; y: number }; end: { x: number; y: number } }> = [];
          for (let i = 0; i < polyline.length - 1; i += 1) {
            const start = polyline[i];
            const end = polyline[i + 1];
            const length = Math.hypot(end.x - start.x, end.y - start.y);
            total += length;
            segments.push({ length, start, end });
          }
          if (total === 0) {
            const start = polyline[0];
            return { x: start.x, y: start.y };
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
          const last = segments.at(-1);
          return last ? { x: last.end.x, y: last.end.y } : polyline[0];
        };

      const path = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');

      if (points.length <= 2) {
        const labelX = (sourceX + targetX) / 2;
        const labelY = (sourceY + targetY) / 2;
        const controlPoint = controlData ?? { x: labelX, y: labelY };
        return { path, labelX, labelY, controlPoint };
      }

      const midIndex = Math.floor(points.length / 2);
      const prev = points[midIndex - 1];
      const next = points[midIndex];
      const labelX = (prev.x + next.x) / 2;
      const labelY = (prev.y + next.y) / 2;
      const controlPoint = controlData ?? computePolylineMidpoint(points);

      return { path, labelX, labelY, controlPoint };
    };

    const { path: edgePath, labelX, labelY, controlPoint } = buildPath();

    const hasLabel = Boolean(data?.label);

    const markerDefinitions = useMemo(() => {
      const buildMarker = (kind: MarkerKind, direction: 'start' | 'end') => {
        if (kind === 'none') return null;
        const size = markerSize;
        const half = size / 2;
        const markerId = `key-marker-${direction}-${id}`;
        if (kind === 'dot') {
          return {
            id: markerId,
            element: (
              <marker
                id={markerId}
                key={markerId}
                markerWidth={size}
                markerHeight={size}
                refX={half}
                refY={half}
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <circle cx={half} cy={half} r={half} fill={strokeColor} />
              </marker>
            ),
          };
        }

        const markerElement = (
          <marker
            id={markerId}
            key={markerId}
            markerWidth={size}
            markerHeight={size}
            refX={direction === 'end' ? size : 0}
            refY={half}
            orient={direction === 'end' ? 'auto' : 'auto-start-reverse'}
            markerUnits="userSpaceOnUse"
          >
            <path d={`M0 0 L${size} ${half} L0 ${size} Z`} fill={strokeColor} />
          </marker>
        );

        return { id: markerId, element: markerElement };
      };

      return {
        start: buildMarker(startMarkerKind, 'start'),
        end: buildMarker(endMarkerKind, 'end'),
      };
    }, [endMarkerKind, id, markerSize, startMarkerKind, strokeColor]);

    const snapValue = (value: number, candidates: number[]) => {
      for (const candidate of candidates) {
        if (Math.abs(value - candidate) <= GRID_SIZE / 2) {
          return candidate;
        }
      }
      const snappedToGrid = Math.round(value / GRID_SIZE) * GRID_SIZE;
      if (Math.abs(value - snappedToGrid) <= GRID_SIZE / 2) {
        return snappedToGrid;
      }
      return value;
    };

    const controlOffsetRef = useRef({ x: 0, y: 0 });

    const handleControlPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();
        setDraggingControl(true);
        const pointer = reactFlow.project({ x: event.clientX, y: event.clientY });
        if (controlPoint) {
          controlOffsetRef.current = {
            x: controlPoint.x - pointer.x,
            y: controlPoint.y - pointer.y,
          };
        } else {
          controlOffsetRef.current = { x: 0, y: 0 };
          updateConnectionControl(id, pointer);
        }

        const handlePointerMove = (moveEvent: PointerEvent) => {
          moveEvent.preventDefault();
          const projected = reactFlow.project({ x: moveEvent.clientX, y: moveEvent.clientY });
          const desired = {
            x: projected.x + controlOffsetRef.current.x,
            y: projected.y + controlOffsetRef.current.y,
          };
          const snapped = {
            x: snapValue(desired.x, [sourceX, targetX, (sourceX + targetX) / 2]),
            y: snapValue(desired.y, [sourceY, targetY, (sourceY + targetY) / 2]),
          };
          updateConnectionControl(id, snapped);
        };

        const handlePointerUp = (upEvent: PointerEvent) => {
          upEvent.preventDefault();
          const projected = reactFlow.project({ x: upEvent.clientX, y: upEvent.clientY });
          const desired = {
            x: projected.x + controlOffsetRef.current.x,
            y: projected.y + controlOffsetRef.current.y,
          };
          const snapped = {
            x: snapValue(desired.x, [sourceX, targetX, (sourceX + targetX) / 2]),
            y: snapValue(desired.y, [sourceY, targetY, (sourceY + targetY) / 2]),
          };
          updateConnectionControl(id, snapped);
          setDraggingControl(false);
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
      },
      [id, reactFlow, sourceX, sourceY, targetX, targetY, updateConnectionControl, controlPoint]
    );

    return (
      <>
        <defs>
          {markerDefinitions.start?.element}
          {markerDefinitions.end?.element}
        </defs>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerDefinitions.end ? `url(#${markerDefinitions.end.id})` : undefined}
          markerStart={markerDefinitions.start ? `url(#${markerDefinitions.start.id})` : undefined}
          style={{
            ...style,
            stroke: strokeColor,
            strokeWidth,
            pointerEvents: 'stroke',
          }}
          interactionWidth={24}
        />
        {hasLabel && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 12}px)`,
                pointerEvents: 'none',
                zIndex: 9,
              }}
              className={`max-w-[200px] whitespace-pre-wrap break-words rounded px-1 py-1 text-xs font-semibold shadow ${
                selected ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-600'
              }`}
            >
              {(data?.label ?? '').split(/\n/).map((line, index, arr) => (
                <span key={index}>
                  {line}
                  {index < arr.length - 1 && <br />}
                </span>
              ))}
            </div>
          </EdgeLabelRenderer>
        )}
        {selected && controlPoint && (
          <EdgeLabelRenderer>
            <div
              onPointerDown={handleControlPointerDown}
              role="presentation"
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${controlPoint.x}px, ${controlPoint.y}px)`,
                pointerEvents: 'all',
                cursor: draggingControl ? 'grabbing' : 'grab',
                zIndex: 8,
              }}
              className="select-none"
            >
              <span
                className={`block h-4 w-4 rounded-full border border-white shadow ${draggingControl ? 'bg-blue-600' : 'bg-blue-500'}`}
              />
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }
);

KeyEdge.displayName = 'KeyEdge';
