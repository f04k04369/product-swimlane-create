'use client';

import { ChangeEvent, DragEvent, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useDiagramStore } from '@/state/useDiagramStore';
import { Button } from '@/components/ui/button';
import { RowShiftPanel } from '@/components/panels/RowShiftPanel';
import { PhasePanel } from '@/components/panels/PhasePanel';
import type { StepKind } from '@/lib/diagram/types';

const inputStyles =
  'w-full rounded-md border border-border bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40';

const numberInputStyles = `${inputStyles} text-right`;

const handleNumber = (event: ChangeEvent<HTMLInputElement>, fallback = 0) => {
  const value = Number(event.target.value);
  return Number.isFinite(value) ? value : fallback;
};

const StepPanelInner = () => {
  const { lanes, steps, connections } = useDiagramStore((state) => state.diagram);
  const selection = useDiagramStore((state) => state.selection);
  const updateStep = useDiagramStore((state) => state.updateStep);
  const removeStep = useDiagramStore((state) => state.removeStep);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const moveStepUp = useDiagramStore((state) => state.moveStepUp);
  const moveStepDown = useDiagramStore((state) => state.moveStepDown);
  const reorderStep = useDiagramStore((state) => state.reorderStep);
  const changeStepKind = useDiagramStore((state) => state.changeStepKind);
  const updateConnectionLabel = useDiagramStore((state) => state.updateConnectionLabel);
  const updateConnectionMarker = useDiagramStore((state) => state.updateConnectionMarker);
  const updateConnectionControl = useDiagramStore((state) => state.updateConnectionControl);
  const updateConnectionEndpoints = useDiagramStore((state) => state.updateConnectionEndpoints);
  const reverseConnection = useDiagramStore((state) => state.reverseConnection);
  const removeConnection = useDiagramStore((state) => state.removeConnection);
  const clearPendingInsert = useDiagramStore((state) => state.clearPendingInsert);
  const pendingInsert = useDiagramStore((state) => state.pendingInsert);

  const selectedStepId = selection.steps[0] ?? null;
  const selectedConnectionId = selection.connections[0] ?? null;

  const selectedStep = useMemo(
    () => steps.find((step) => step.id === selectedStepId) ?? null,
    [steps, selectedStepId]
  );

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connections, selectedConnectionId]
  );

  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);

  const laneOrderMap = useMemo(() => new Map(lanes.map((lane) => [lane.id, lane.order] as const)), [lanes]);

  const sortedSteps = useMemo(() => {
    return steps
      .slice()
      .sort((a, b) => {
        const laneOrderA = laneOrderMap.get(a.laneId) ?? 0;
        const laneOrderB = laneOrderMap.get(b.laneId) ?? 0;
        if (laneOrderA !== laneOrderB) return laneOrderA - laneOrderB;
        return a.order - b.order;
      });
  }, [steps, laneOrderMap]);

  const laneStepsOrdered = useMemo(() => {
    if (!selectedStep) return [];
    return steps
      .filter((step) => step.laneId === selectedStep.laneId)
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [selectedStep, steps]);

  if (!selectedStep && !selectedConnection) {
    if (pendingInsert) {
      return <RowShiftPanel />;
    }
    return (
      <aside className="w-80 border-l border-border bg-white px-4 py-6">
        <h2 className="text-sm font-semibold text-slate-700">詳細</h2>
        <p className="mt-4 text-sm text-slate-500">
          ステップ・矢印・行ハンドルを選択すると、ここで編集できます。
        </p>
      </aside>
    );
  }

  if (selectedConnection) {
    const sourceStep = steps.find((step) => step.id === selectedConnection.sourceId) ?? null;
    const targetStep = steps.find((step) => step.id === selectedConnection.targetId) ?? null;
    const currentLabel = selectedConnection.label ?? '';
    const charCount = currentLabel.length;
    const currentStartMarker = selectedConnection.startMarker ?? 'none';
    const currentEndMarker = selectedConnection.endMarker ?? 'arrow';
    const currentMarkerSize = selectedConnection.markerSize ?? 16;
    const markerOptions: Array<{ label: string; value: 'none' | 'arrow' | 'dot' }> = [
      { label: 'なし', value: 'none' },
      { label: '矢印', value: 'arrow' },
      { label: 'ドット', value: 'dot' },
    ];
    const hasControlPoint = Boolean(selectedConnection.control);

    const handleLabelChange = (label: string) => {
      clearPendingInsert();
      updateConnectionLabel(selectedConnection.id, label);
      setSelection({ lanes: [], steps: [], connections: [selectedConnection.id] });
    };

    const handleMarkerUpdate = (updates: Partial<{ startMarker: 'none' | 'arrow' | 'dot'; endMarker: 'none' | 'arrow' | 'dot'; markerSize: number }>) => {
      clearPendingInsert();
      updateConnectionMarker(selectedConnection.id, updates);
      setSelection({ lanes: [], steps: [], connections: [selectedConnection.id] });
    };

    const handleSourceStepChange = (event: ChangeEvent<HTMLSelectElement>) => {
      const nextSourceId = event.target.value;
      if (!nextSourceId) return;
      clearPendingInsert();
      updateConnectionEndpoints(selectedConnection.id, { sourceId: nextSourceId });
      setSelection({ lanes: [], steps: [], connections: [selectedConnection.id] });
    };

    const handleTargetStepChange = (event: ChangeEvent<HTMLSelectElement>) => {
      const nextTargetId = event.target.value;
      if (!nextTargetId) return;
      clearPendingInsert();
      updateConnectionEndpoints(selectedConnection.id, { targetId: nextTargetId });
      setSelection({ lanes: [], steps: [], connections: [selectedConnection.id] });
    };

    const handleReverse = () => {
      clearPendingInsert();
      reverseConnection(selectedConnection.id);
      setSelection({ lanes: [], steps: [], connections: [selectedConnection.id] });
    };

    return (
      <aside className="flex h-full w-80 flex-col border-l border-border bg-white">
        <header className="border-b border-border px-4 py-4">
          <h2 className="text-sm font-semibold text-slate-700">矢印編集</h2>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500">接続元</p>
            <p className="mt-1 text-sm text-slate-700">{sourceStep?.title ?? '未設定'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">接続先</p>
            <p className="mt-1 text-sm text-slate-700">{targetStep?.title ?? '未設定'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">条件ラベル</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { label: 'なし', value: '' },
                { label: 'yes', value: 'yes' },
                { label: 'no', value: 'no' },
              ].map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant={currentLabel === option.value ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => handleLabelChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <textarea
              className={`${inputStyles} mt-3 h-20 resize-none`}
              maxLength={50}
              value={currentLabel}
              onChange={(event) => handleLabelChange(event.target.value)}
              placeholder="任意テキスト (50文字以内、改行可)"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-400">
              <span>Delete / Backspace キーでも削除できます。</span>
              <span>{charCount}/50</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500">接続元ステップ</p>
              <select className={inputStyles} value={selectedConnection.sourceId} onChange={handleSourceStepChange}>
                {sortedSteps.map((step) => {
                  const lane = lanes.find((laneItem) => laneItem.id === step.laneId);
                  return (
                    <option key={step.id} value={step.id}>
                      {lane ? `${lane.title} / ` : ''}{step.title || '無題のステップ'}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">接続先ステップ</p>
              <select className={inputStyles} value={selectedConnection.targetId} onChange={handleTargetStepChange}>
                {sortedSteps.map((step) => {
                  const lane = lanes.find((laneItem) => laneItem.id === step.laneId);
                  return (
                    <option key={step.id} value={step.id}>
                      {lane ? `${lane.title} / ` : ''}{step.title || '無題のステップ'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={handleReverse}>
              接続を反転
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500">開始マーカー</p>
              <select
                className={inputStyles}
                value={currentStartMarker}
                onChange={(event) => handleMarkerUpdate({ startMarker: event.target.value as 'none' | 'arrow' | 'dot' })}
              >
                {markerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">終端マーカー</p>
              <select
                className={inputStyles}
                value={currentEndMarker}
                onChange={(event) => handleMarkerUpdate({ endMarker: event.target.value as 'none' | 'arrow' | 'dot' })}
              >
                {markerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500">矢印サイズ</p>
              <input
                className={numberInputStyles}
                type="number"
                min={4}
                max={64}
                value={currentMarkerSize}
                onChange={(event) =>
                  handleMarkerUpdate({
                    markerSize: Math.max(4, Math.min(64, handleNumber(event, currentMarkerSize))),
                  })
                }
              />
            </div>
            <div className="flex items-end justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  clearPendingInsert();
                  updateConnectionControl(selectedConnection.id, null);
                  setSelection({ lanes: [], steps: [], connections: [selectedConnection.id] });
                }}
                disabled={!hasControlPoint}
              >
                制御点リセット
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            コネクタ中心のハンドルをドラッグすると折れ曲がり位置を調整できます。
          </p>
        </div>
        <div className="border-t border-border px-4 py-4">
          <Button
            type="button"
            variant="outline"
            className="w-full bg-red-50 text-red-600 hover:bg-red-100"
            onClick={() => {
              clearPendingInsert();
              removeConnection(selectedConnection.id);
              setSelection({ lanes: [], steps: [], connections: [] });
            }}
          >
            矢印を削除
          </Button>
        </div>
      </aside>
    );
  }

  if (!selectedStep) {
    return null;
  }

  const currentIndex = laneStepsOrdered.findIndex((step) => step.id === selectedStep.id);
  const canMoveUp = selectedStep.order > 0;
  const canMoveDown = currentIndex !== -1;

  const handleStepDragStart = (event: DragEvent<HTMLLIElement>, stepId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', stepId);
    clearPendingInsert();
    setDraggedStepId(stepId);
  };

  const handleStepDragEnd = () => {
    setDraggedStepId(null);
  };

  const persistSelectionFor = (stepId: string) => {
    const { diagram: latest } = useDiagramStore.getState();
    const target = latest.steps.find((step) => step.id === stepId);
    if (target) {
      clearPendingInsert();
      setSelection({ lanes: [target.laneId], steps: [target.id], connections: [] });
    }
  };

  const handleStepDrop = (event: DragEvent<HTMLLIElement>, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dropAfter = event.clientY - rect.top > rect.height / 2;
    const targetIndex = dropAfter ? index + 1 : index;
    clearPendingInsert();
    reorderStep(draggedId, targetIndex);
    persistSelectionFor(draggedId);
    setDraggedStepId(null);
  };

  const handleListDrop = (event: DragEvent<HTMLUListElement>) => {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    clearPendingInsert();
    reorderStep(draggedId, laneStepsOrdered.length);
    persistSelectionFor(draggedId);
    setDraggedStepId(null);
  };

  const handleListDragOver = (event: DragEvent<HTMLUListElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleLaneChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLaneId = event.target.value;
    const laneIndex = lanes.findIndex((lane) => lane.id === nextLaneId);
    if (laneIndex === -1 || !selectedStep) return;
    clearPendingInsert();
    updateStep(selectedStep.id, { laneId: nextLaneId });
    setSelection({ lanes: [nextLaneId], steps: [selectedStep.id], connections: [] });
  };

  const handleKindChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!selectedStep) return;
    clearPendingInsert();
    changeStepKind(selectedStep.id, event.target.value as StepKind);
  };

  const handleRowChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedStep) return;
    const nextRow = Math.max(0, handleNumber(event, selectedStep.order + 1) - 1);
    clearPendingInsert();
    updateStep(selectedStep.id, { order: nextRow });
    setSelection({ lanes: [selectedStep.laneId], steps: [selectedStep.id], connections: [] });
  };

  const handleStepDragOverItem = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  return (
    <aside className="flex h-full w-80 flex-col border-l border-border bg-white">
      <header className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-700">ステップ編集</h2>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <label className="text-xs font-medium text-slate-500">タイトル</label>
          <input
            className={inputStyles}
            value={selectedStep.title}
            onChange={(event) => updateStep(selectedStep.id, { title: event.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">説明</label>
          <textarea
            className={`${inputStyles} min-h-[80px] resize-none`}
            value={selectedStep.description ?? ''}
            onChange={(event) => updateStep(selectedStep.id, { description: event.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">所属レーン</label>
          <select className={inputStyles} value={selectedStep.laneId} onChange={handleLaneChange}>
            {lanes
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.title}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">ステップ種別</label>
          <select className={inputStyles} value={selectedStep.kind} onChange={handleKindChange}>
            <option value="process">標準</option>
            <option value="decision">条件分岐</option>
            <option value="start">開始</option>
            <option value="end">終了</option>
            <option value="file">ファイル処理</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">行番号</label>
          <input
            className={numberInputStyles}
            type="number"
            min={1}
            value={selectedStep.order + 1}
            onChange={handleRowChange}
          />
          <p className="mt-1 text-[11px] text-slate-400">1始まりで指定できます（未使用の行は空白セルとして扱われます）。</p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">レーン内の順序</label>
          <ul
            className="mt-2 space-y-1"
            onDragOver={handleListDragOver}
            onDrop={handleListDrop}
          >
            {laneStepsOrdered.map((step, index) => (
              <li
                key={step.id}
                draggable
                onDragStart={(event) => handleStepDragStart(event, step.id)}
                onDragEnd={handleStepDragEnd}
                onDrop={(event) => handleStepDrop(event, index)}
                onDragOver={handleStepDragOverItem}
                onClick={() => {
                  clearPendingInsert();
                  setSelection({ lanes: [step.laneId], steps: [step.id], connections: [] });
                }}
                className={classNames(
                  'flex items-center justify-between rounded-md border px-3 py-2 text-xs transition',
                  {
                    'cursor-grabbing opacity-70': draggedStepId === step.id,
                    'cursor-grab': draggedStepId !== step.id,
                    'border-primary bg-primary/10 text-primary': step.id === selectedStep.id,
                    'border-border bg-white text-slate-700': step.id !== selectedStep.id,
                  }
                )}
              >
                <span className="mr-2 truncate">{step.title || `ステップ ${index + 1}`}</span>
                <span className="text-[10px] font-medium text-slate-400">行 {step.order + 1}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-slate-400">
            ドラッグ＆ドロップで呼び順を詰め替えると、行番号が連番に再配置されます。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              clearPendingInsert();
              moveStepUp(selectedStep.id);
              setSelection({ lanes: [selectedStep.laneId], steps: [selectedStep.id], connections: [] });
            }}
            disabled={!canMoveUp}
          >
            上へ移動
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              clearPendingInsert();
              moveStepDown(selectedStep.id);
              setSelection({ lanes: [selectedStep.laneId], steps: [selectedStep.id], connections: [] });
            }}
            disabled={!canMoveDown}
          >
            下へ移動
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500">幅 (px)</label>
            <input
              className={numberInputStyles}
              type="number"
              min={120}
              value={selectedStep.width}
              onChange={(event) => updateStep(selectedStep.id, { width: handleNumber(event, 200) })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">高さ (px)</label>
            <input
              className={numberInputStyles}
              type="number"
              min={60}
              value={selectedStep.height}
              onChange={(event) => updateStep(selectedStep.id, { height: handleNumber(event, 96) })}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">カラー</label>
          <input
            className={`${inputStyles} h-10 cursor-pointer`}
            type="color"
            value={selectedStep.color}
            onChange={(event) => updateStep(selectedStep.id, { color: event.target.value })}
          />
        </div>
      </div>
      <div className="border-t border-border px-4 py-4">
        <Button
          type="button"
          variant="outline"
          className="w-full bg-red-50 text-red-600 hover:bg-red-100"
          onClick={() => {
            clearPendingInsert();
            removeStep(selectedStep.id);
            setSelection({ lanes: [], steps: [], connections: [] });
          }}
        >
          ステップを削除
        </Button>
      </div>
    </aside>
  );
};

export const StepPanel = () => {
  const selection = useDiagramStore((state) => state.selection);
  const selectedPhaseId = selection.phases[0] ?? null;
  if (selectedPhaseId) {
    return <PhasePanel phaseId={selectedPhaseId} />;
  }
  return <StepPanelInner />;
};
