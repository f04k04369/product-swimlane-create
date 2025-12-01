import type { CSSProperties } from 'react';
import type { NodeProps } from 'reactflow';
import { useRef } from 'react';
import { useDiagramStore } from '@/state/useDiagramStore';

import { getContrastingTextColor, hexToRgb, mixRgb, rgbToCss, rgbaToCss } from '@/components/canvas/laneColors';
import type { DiagramOrientation } from '@/lib/diagram/types';

interface LaneNodeData {
  id: string;
  title: string;
  color: string;
  height: number;
  width: number;
  isSelected?: boolean;
  pendingRow: number | null;
  rowHeight: number;
  highlightWidth: number;
  lanePadding: number;
  orientation: DiagramOrientation;
  onRowHandleClick?: (laneId: string, row: number) => void;
}

export const LaneNode = ({ data }: NodeProps<LaneNodeData>) => {
  const { id, title, color, height, width, pendingRow, rowHeight, highlightWidth, lanePadding, orientation, onRowHandleClick } = data;
  const updateLane = useDiagramStore((state) => state.updateLane);
  const isHorizontal = orientation === 'horizontal';
  const laneThickness = isHorizontal ? height : width;
  const laneLength = isHorizontal ? width : height;
  const refSize = useRef(laneThickness);
  const highlightOffset = pendingRow !== null ? lanePadding + pendingRow * rowHeight : null;
  const rowAreaSpan = Math.max(0, laneLength - lanePadding * 2);
  const rowCount = Math.max(1, Math.round(rowAreaSpan / rowHeight));
  const handleThickness = 6;
  const baseColor = hexToRgb(color);
  const laneFillColor = mixRgb(baseColor, { r: 255, g: 255, b: 255 }, 0.9);
  const laneBorderTint = mixRgb(baseColor, { r: 148, g: 163, b: 184 }, 0.55);
  const headerFillColor = mixRgb(baseColor, { r: 255, g: 255, b: 255 }, 0.7);
  const headerTextColor = getContrastingTextColor(headerFillColor);

  const inlineHeaderStyle: CSSProperties = {
    backgroundColor: rgbToCss(headerFillColor),
    borderBottom: `1px solid ${rgbaToCss(laneBorderTint, 0.6)}`,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    color: headerTextColor,
    opacity: 0,
    pointerEvents: 'none',
    visibility: 'hidden',
  };
  return (
    <div
      data-lane-id={id}
      style={{
        borderColor: rgbaToCss(laneBorderTint, 0.45),
        backgroundColor: rgbaToCss(laneFillColor, 0.85),
        height,
        width,
        cursor: 'default',
      }}
      className="relative flex h-full w-full flex-col rounded-2xl border border-dashed border-slate-200 bg-white/70 shadow-inner"
    >
      {highlightOffset !== null &&
        (isHorizontal ? (
          <div
            className="pointer-events-none absolute top-0 bottom-0 border border-dashed border-blue-400/70 bg-blue-200/30"
            style={{ left: highlightOffset, width: highlightWidth }}
          />
        ) : (
          <div
            className="pointer-events-none absolute left-0 right-0 border border-dashed border-blue-400/70 bg-blue-200/30"
            style={{ top: highlightOffset, height: highlightWidth }}
          />
        ))}
      {Array.from({ length: rowCount }, (_, index) => {
        const axisLabel = isHorizontal ? '列' : '行';
        if (isHorizontal) {
          const baseLeft = lanePadding + index * rowHeight;
          const left = baseLeft;
          return (
            <button
              key={`${id}-handle-${index}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRowHandleClick?.(id, index);
              }}
              className="absolute top-4 bottom-4 z-10 transition hover:bg-slate-200/20"
              style={{ left: Math.max(left, lanePadding), width: rowHeight }}
              aria-label={`${title} の${axisLabel} ${index + 1} を操作`}
            >
              <div
                className="absolute inset-y-0 rounded-full border border-dotted border-slate-300/50 bg-white/30 transition hover:bg-slate-200/60"
                style={{ left: '50%', transform: 'translateX(-50%)', width: handleThickness }}
              />
            </button>
          );
        }
        const top = lanePadding + index * rowHeight - handleThickness / 2;
        return (
          <button
            key={`${id}-handle-${index}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRowHandleClick?.(id, index);
            }}
            className="absolute left-4 right-4 z-10 rounded-full border border-dotted border-slate-300/50 bg-white/30 transition hover:bg-slate-200/60"
            style={{ top: Math.max(top, lanePadding - handleThickness / 2), height: handleThickness }}
            aria-label={`${title} の${axisLabel} ${index + 1} を操作`}
          />
        );
      })}
      <div
        aria-hidden
        className="rounded-t-2xl px-4 py-3 text-sm font-semibold"
        data-lane-inline-header="true"
        style={inlineHeaderStyle}
      >
        <span data-inline-header-text style={{ color: headerTextColor }}>{title}</span>
      </div>
      <div className="flex-1" />
      <div
        role="presentation"
        className={
          isHorizontal
            ? 'absolute left-0 right-0 bottom-[-8px] h-4 cursor-ns-resize rounded-sm bg-amber-400/80 transition-colors hover:bg-amber-500'
            : 'absolute top-0 bottom-0 right-[-8px] w-4 cursor-ew-resize rounded-sm bg-amber-400/80 transition-colors hover:bg-amber-500'
        }
        style={{ zIndex: 1000, pointerEvents: 'all' }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          refSize.current = laneThickness;
          const startX = e.clientX;
          const startY = e.clientY;
          const handleMove = (me: PointerEvent) => {
            me.preventDefault();
            const delta = isHorizontal ? me.clientY - startY : me.clientX - startX;
            const next = Math.max(200, Math.round(refSize.current + delta));
            updateLane(id, { width: next });
          };
          const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
          };
          window.addEventListener('pointermove', handleMove);
          window.addEventListener('pointerup', handleUp);
        }}
        aria-label={`${title} の幅を変更`}
      />
    </div>
  );
};
