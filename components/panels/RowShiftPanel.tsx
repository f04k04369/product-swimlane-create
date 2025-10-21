import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useDiagramStore } from '@/state/useDiagramStore';

const inputStyles =
  'w-full rounded-md border border-border bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40';

type ShiftScope = 'lane' | 'all';
type ShiftDirection = 'down' | 'up';

export const RowShiftPanel = () => {
  const pendingInsert = useDiagramStore((state) => state.pendingInsert);
  const lanes = useDiagramStore((state) => state.diagram.lanes);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const shiftRows = useDiagramStore((state) => state.shiftRows);
  const clearPendingInsert = useDiagramStore((state) => state.clearPendingInsert);

  const [scope, setScope] = useState<ShiftScope>('lane');
  const [amount, setAmount] = useState(1);
  const [direction, setDirection] = useState<ShiftDirection>('down');

  const lane = useMemo(
    () => lanes.find((candidate) => candidate.id === pendingInsert?.laneId) ?? null,
    [lanes, pendingInsert]
  );

  if (!pendingInsert || !lane) {
    return (
      <aside className="w-80 border-l border-border bg-white px-4 py-6">
        <h2 className="text-sm font-semibold text-slate-700">行操作</h2>
        <p className="mt-4 text-sm text-slate-500">行ハンドルをクリックすると、ここで行の一括操作ができます。</p>
      </aside>
    );
  }

  const handleShift = () => {
    const normalized = Math.max(1, Math.floor(amount));
    shiftRows(pendingInsert.row, normalized, {
      scope,
      laneId: pendingInsert.laneId,
      direction,
    });

    if (scope === 'lane') {
      setSelection({ lanes: [pendingInsert.laneId], steps: [], connections: [] });
    } else {
      setSelection({ lanes: [], steps: [], connections: [] });
    }

    setAmount(1);
  };

  const handleCancel = () => {
    clearPendingInsert();
  };

  return (
    <aside className="flex h-full w-80 flex-col border-l border-border bg-white">
      <header className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-700">行の調整</h2>
        <p className="mt-1 text-xs text-slate-500">
          {lane.title} の {pendingInsert.row + 1} 行目以降をまとめて移動できます。
        </p>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <p className="text-xs font-medium text-slate-500">移動方向</p>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="row-shift-direction"
                value="down"
                checked={direction === 'down'}
                onChange={() => setDirection('down')}
              />
              下へ下げる
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="row-shift-direction"
                value="up"
                checked={direction === 'up'}
                onChange={() => setDirection('up')}
              />
              上へ詰める
            </label>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">対象範囲</p>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="row-shift-scope"
                value="lane"
                checked={scope === 'lane'}
                onChange={() => setScope('lane')}
              />
              選択レーンのみ
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="row-shift-scope"
                value="all"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
              />
              すべてのレーン
            </label>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500" htmlFor="row-shift-amount">
            何行動かすか
          </label>
          <input
            id="row-shift-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(event) => {
              const next = Number(event.target.value);
              setAmount(Number.isFinite(next) ? next : 1);
            }}
            className={`${inputStyles} mt-1`}
          />
          <p className="mt-1 text-[11px] text-slate-400">正の整数で指定してください。</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <p>行移動後もステップやコネクタの接続関係は維持されます。</p>
          <p>
            {direction === 'down'
              ? '対象行より下のステップが指定行数ぶん下方へ移動します。'
              : '対象行より下のステップが指定行数ぶん上方へ詰められます。'}
          </p>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border px-4 py-4">
        <Button type="button" className="flex-1" onClick={handleShift}>
          行を移動
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
          キャンセル
        </Button>
      </div>
    </aside>
  );
};
