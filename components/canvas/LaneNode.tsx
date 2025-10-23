import type { NodeProps } from 'reactflow';

interface LaneNodeData {
  id: string;
  title: string;
  color: string;
  height: number;
  width: number;
  pendingRow: number | null;
  rowHeight: number;
  lanePadding: number;
  onRowHandleClick?: (laneId: string, row: number) => void;
}

export const LaneNode = ({ data }: NodeProps<LaneNodeData>) => {
  const { id, title, color, height, width, pendingRow, rowHeight, lanePadding, onRowHandleClick } = data;
  const highlightTop = pendingRow !== null ? lanePadding + pendingRow * rowHeight : null;
  const rowAreaHeight = Math.max(0, height - lanePadding * 2);
  const rowCount = Math.max(1, Math.round(rowAreaHeight / rowHeight));
  const handleThickness = 6;

  return (
    <div
      data-lane-id={id}
      style={{
        borderColor: `${color}40`,
        height,
        width,
        cursor: 'default',
      }}
      className="relative flex h-full w-full flex-col rounded-2xl border border-dashed border-slate-200 bg-white/70 shadow-inner"
    >
      {highlightTop !== null && (
        <div
          className="pointer-events-none absolute left-0 right-0 border border-dashed border-blue-400/70 bg-blue-200/30"
          style={{ top: highlightTop, height: rowHeight }}
        />
      )}
      {Array.from({ length: rowCount }, (_, index) => {
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
            aria-label={`${title} の行 ${index + 1} を操作`}
          />
        );
      })}
      <div className="h-12" aria-hidden>
        <span className="sr-only">{title}</span>
      </div>
      <div className="flex-1" />
    </div>
  );
};
