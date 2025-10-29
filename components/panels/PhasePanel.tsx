'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDiagramStore } from '@/state/useDiagramStore';

const inputStyles =
  'w-full rounded-md border border-border bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40';

interface PhasePanelProps {
  phaseId: string;
}

export const PhasePanel = ({ phaseId }: PhasePanelProps) => {
  const diagram = useDiagramStore((state) => state.diagram);
  const updatePhaseGroup = useDiagramStore((state) => state.updatePhaseGroup);
  const removePhaseGroup = useDiagramStore((state) => state.removePhaseGroup);
  const setSelection = useDiagramStore((state) => state.setSelection);

  const phase = diagram.phaseGroups.find((item) => item.id === phaseId) ?? null;

  const stepRows = useMemo(() => {
    return diagram.steps.reduce((rows, step) => {
      const order = Number.isFinite(step.order) ? Math.max(0, Math.round(step.order)) : 0;
      rows.add(order);
      return rows;
    }, new Set<number>());
  }, [diagram.steps]);

  const [title, setTitle] = useState('');
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phase) return;
    setTitle(phase.title);
    setStartRow(phase.startRow + 1);
    setEndRow(phase.endRow + 1);
    setError(null);
  }, [phaseId, phase]);

  if (!phase) {
    return (
      <aside className="w-80 border-l border-border bg-white px-4 py-6">
        <h2 className="text-sm font-semibold text-slate-700">フェーズ編集</h2>
        <p className="mt-4 text-sm text-slate-500">フェーズが見つかりません。再度選択してください。</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => setSelection({ phases: [] })}
        >
          選択解除
        </Button>
      </aside>
    );
  }

  const validate = (nextStart: number, nextEnd: number, nextTitle: string) => {
    if (nextStart < 1 || nextEnd < 1) {
      return '行番号は1以上を指定してください。';
    }
    if (nextStart > nextEnd) {
      return '開始行は終了行以下になるよう指定してください。';
    }
    for (let row = nextStart - 1; row <= nextEnd - 1; row += 1) {
      if (!stepRows.has(row)) {
        return `行${row + 1}にステップがありません。`;
      }
    }
    if (nextTitle.trim().length === 0) {
      return 'フェーズ名を入力してください。';
    }
    return null;
  };

  const handleSave = () => {
    const validationError = validate(startRow, endRow, title);
    if (validationError) {
      setError(validationError);
      return;
    }
    updatePhaseGroup(phase.id, {
      title: title.trim(),
      startRow: Math.min(startRow, endRow) - 1,
      endRow: Math.max(startRow, endRow) - 1,
    });
    setError(null);
  };

  const handleDelete = () => {
    removePhaseGroup(phase.id);
    setSelection({ phases: [] });
  };

  const handleCancel = () => {
    if (!phase) return;
    setTitle(phase.title);
    setStartRow(phase.startRow + 1);
    setEndRow(phase.endRow + 1);
    setError(null);
  };

  return (
    <aside className="flex h-full w-80 flex-col border-l border-border bg-white">
      <header className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-700">フェーズ編集</h2>
        <p className="mt-1 text-xs text-slate-500">レーン左のフェーズラベルで選択した内容を編集できます。</p>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <label className="text-xs font-medium text-slate-500" htmlFor="phase-panel-title">
            フェーズ名
          </label>
          <input
            id="phase-panel-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={`${inputStyles} mt-1`}
            placeholder="例: 要件定義"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500" htmlFor="phase-panel-start">
            開始行
            <input
              id="phase-panel-start"
              type="number"
              min={1}
              value={startRow}
              onChange={(event) => setStartRow(Number(event.target.value) || 1)}
              className={inputStyles}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500" htmlFor="phase-panel-end">
            終了行
            <input
              id="phase-panel-end"
              type="number"
              min={1}
              value={endRow}
              onChange={(event) => setEndRow(Number(event.target.value) || 1)}
              className={inputStyles}
            />
          </label>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p>行 {Math.min(startRow, endRow)} 〜 {Math.max(startRow, endRow)} をカバーします。</p>
          <p className="mt-1">各行にステップが存在する必要があります。</p>
        </div>
        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs font-medium text-rose-500">{error}</p>}
      </div>
      <footer className="flex items-center justify-between border-t border-border px-4 py-3">
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            リセット
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={handleDelete}
          >
            削除
          </Button>
        </div>
        <Button type="button" onClick={handleSave}>
          保存
        </Button>
      </footer>
    </aside>
  );
};
