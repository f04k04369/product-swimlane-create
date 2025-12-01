import { useMemo } from 'react';
import { useDiagramStore } from '@/state/useDiagramStore';
import { Button } from '@/components/ui/button';

const inputStyles =
  'w-full rounded-md border border-border bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40';

export const LanePanel = () => {
  const lanes = useDiagramStore((state) => state.diagram.lanes);
  const selection = useDiagramStore((state) => state.selection);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const updateLane = useDiagramStore((state) => state.updateLane);
  const removeLane = useDiagramStore((state) => state.removeLane);
  const reorderLane = useDiagramStore((state) => state.reorderLane);

  const selectedLaneId = selection.lanes[0] ?? lanes[0]?.id;

  const handleSelect = (laneId: string) => {
    setSelection({ lanes: [laneId], steps: [], connections: [] });
  };

  const laneCount = lanes.length;

  const orderedLanes = useMemo(() => lanes.slice().sort((a, b) => a.order - b.order), [lanes]);

  return (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-white">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">レーン</h2>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {orderedLanes.map((lane, index) => (
          <div
            key={lane.id}
            data-testid="lane-card"
            className={`rounded-lg border px-3 py-2 shadow-sm transition ${
              lane.id === selectedLaneId ? 'border-primary shadow-card' : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleSelect(lane.id)}
                className="flex items-center gap-2"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: lane.color }}
                  aria-hidden
                />
                <span className="text-sm font-medium text-slate-700">レーン {lane.order + 1}</span>
              </button>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => reorderLane(lane.id, index - 1)}
                  disabled={index === 0}
                  aria-label="上へ移動"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => reorderLane(lane.id, index + 1)}
                  disabled={index === laneCount - 1}
                  aria-label="下へ移動"
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLane(lane.id)}
                  disabled={laneCount <= 1}
                  aria-label="レーン削除"
                >
                  ×
                </Button>
              </div>
            </div>
            <label className="mt-2 block text-xs font-medium text-slate-500">名称</label>
            <input
              className={inputStyles}
              value={lane.title}
              onChange={(event) => updateLane(lane.id, { title: event.target.value })}
            />
            <label className="mt-2 block text-xs font-medium text-slate-500">タイトルカラー</label>
            <input
              className={`${inputStyles} h-10 cursor-pointer`}
              type="color"
              value={lane.color || '#0ea5e9'}
              onChange={(event) => updateLane(lane.id, { color: event.target.value })}
              aria-label={`${lane.title || `レーン ${lane.order + 1}`}のタイトルカラー`}
            />
            <label className="mt-2 block text-xs font-medium text-slate-500">説明</label>
            <textarea
              className={`${inputStyles} min-h-[60px] resize-none`}
              value={lane.description ?? ''}
              onChange={(event) => updateLane(lane.id, { description: event.target.value })}
            />
          </div>
        ))}
        {orderedLanes.length === 0 && (
          <p className="text-sm text-slate-500">レーンがありません。上部メニューから追加してください。</p>
        )}
      </div>
    </aside>
  );
};
