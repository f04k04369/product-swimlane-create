import { ReactFlowProvider } from 'reactflow';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LanePanel } from '@/components/panels/LanePanel';
import { StepPanel } from '@/components/panels/StepPanel';
import { SwimlaneCanvas } from '@/components/canvas/SwimlaneCanvas';
import { useDiagramStore } from '@/state/useDiagramStore';
import { MermaidDialog } from '@/components/export/MermaidDialog';
import { AuditLogDialog } from '@/components/export/AuditLogDialog';
import { exportDiagramToPng } from '@/lib/export/png';
import type { StepKind } from '@/lib/diagram/types';

export const SwimlaneEditor = () => {
  const addLane = useDiagramStore((state) => state.addLane);
  const addStep = useDiagramStore((state) => state.addStep);
  const removeStep = useDiagramStore((state) => state.removeStep);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const reset = useDiagramStore((state) => state.reset);
  const selection = useDiagramStore((state) => state.selection);
  const diagram = useDiagramStore((state) => state.diagram);
  const canUndo = useDiagramStore((state) => state.canUndo);
  const canRedo = useDiagramStore((state) => state.canRedo);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const pendingInsert = useDiagramStore((state) => state.pendingInsert);
  const requestScrollToTop = useDiagramStore((state) => state.requestScrollToTop);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [status, setStatus] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [lanePanelOpen, setLanePanelOpen] = useState(true);
  const [stepPanelOpen, setStepPanelOpen] = useState(true);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  const handleAddStep = (kind: StepKind = 'process') => {
    if (!pendingInsert) {
      setStatus({ type: 'error', text: 'ステップを追加する行をクリックしてください' });
      return;
    }
    const createdId = addStep({ kind });
    if (!createdId) {
      setStatus({ type: 'error', text: 'ステップを追加できませんでした。行を選択しているか確認してください。' });
    } else {
      setStatus({ type: 'info', text: 'ステップを追加しました' });
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        return;
      }
      const stepId = selection.steps[0];
      if (!stepId) return;
      event.preventDefault();
      removeStep(stepId);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection.steps, removeStep]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) return;
      if (event.key.toLowerCase() === 'z') {
        if (event.shiftKey) {
          if (!canRedo) return;
          event.preventDefault();
          redo();
        } else {
          if (!canUndo) return;
          event.preventDefault();
          undo();
        }
      }
      if (!event.shiftKey && event.key.toLowerCase() === 'y') {
        if (!canRedo) return;
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canRedo, canUndo, redo, undo]);

  const handleExportPng = async () => {
    if (!canvasRef.current) return;
    try {
      await exportDiagramToPng(canvasRef.current, `${diagram.title || 'swimlane'}.png`);
      setStatus({ type: 'info', text: 'PNGをダウンロードしました' });
    } catch (error) {
      setStatus({ type: 'error', text: (error as Error).message ?? 'PNG出力に失敗しました' });
    }
  };

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Swimlane Studio</h1>
            <p className="text-xs text-slate-500">
              レーンを整列させた業務フロー図を作成し、Mermaid記法で再利用可能。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                addLane();
                const { diagram: latest } = useDiagramStore.getState();
                const newestLane = latest.lanes[latest.lanes.length - 1];
                if (newestLane) {
                  setSelection({ lanes: [newestLane.id], steps: [], connections: [] });
                }
              }}
            >
              レーンを追加
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddStep('process')}
                disabled={!pendingInsert}
              >
                標準ステップ
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddStep('decision')}
                disabled={!pendingInsert}
              >
                条件分岐
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddStep('start')}
                disabled={!pendingInsert}
              >
                開始
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddStep('end')}
                disabled={!pendingInsert}
              >
                終了
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddStep('file')}
                disabled={!pendingInsert}
              >
                ファイル処理
              </Button>
            </div>
            <span className="mx-2 hidden h-6 w-px bg-border md:block" />
            <Button type="button" variant="ghost" onClick={undo} disabled={!canUndo}>
              元に戻す
            </Button>
            <Button type="button" variant="ghost" onClick={redo} disabled={!canRedo}>
              やり直す
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              リセット
            </Button>
            <span className="mx-2 hidden h-6 w-px bg-border md:block" />
            <Button type="button" variant="outline" onClick={() => setMermaidOpen(true)}>
              Mermaid入出力
            </Button>
            <Button type="button" variant="outline" onClick={handleExportPng}>
              PNGエクスポート
            </Button>
            <Button type="button" variant="outline" onClick={() => setAuditOpen(true)}>
              監査ログ
            </Button>
            <Button type="button" variant="outline" onClick={requestScrollToTop}>
              レーン最上部へ
            </Button>
            <span className="mx-2 hidden h-6 w-px bg-border md:block" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLanePanelOpen((prev) => !prev)}
            >
              {lanePanelOpen ? 'レーンパネル隠す' : 'レーンパネル表示'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStepPanelOpen((prev) => !prev)}
            >
              {stepPanelOpen ? 'ステップパネル隠す' : 'ステップパネル表示'}
            </Button>
          </div>
        </header>
        {status && (
          <div
            className={`border-b px-6 py-2 text-sm ${
              status.type === 'info'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                : 'border-red-200 bg-red-50 text-red-600'
            }`}
          >
            {status.text}
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">
          {lanePanelOpen && <LanePanel />}
          <SwimlaneCanvas canvasRef={canvasRef} />
          {stepPanelOpen && <StepPanel />}
        </div>
        <MermaidDialog
          open={mermaidOpen}
          onClose={() => setMermaidOpen(false)}
          onStatus={(type, text) => setStatus({ type, text })}
        />
        <AuditLogDialog
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
          onStatus={(type, text) => setStatus({ type, text })}
        />
      </div>
    </ReactFlowProvider>
  );
};
