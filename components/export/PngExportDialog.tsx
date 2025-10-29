'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { captureDiagramPreview, exportCroppedDiagramToPng, type DiagramPngCapture } from '@/lib/export/png';

const DEFAULT_SELECTION_MARGIN = 32;

interface PngExportDialogProps {
  open: boolean;
  onClose: () => void;
  canvasRef: RefObject<HTMLDivElement>;
  filename: string;
  onStatus?: (type: 'info' | 'error', text: string) => void;
}

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PngExportDialog = ({ open, onClose, canvasRef, filename, onStatus }: PngExportDialogProps) => {
  const [capture, setCapture] = useState<DiagramPngCapture | null>(null);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  useEffect(() => {
    if (!open) {
      setCapture(null);
      setSelection(null);
      setError(null);
      setHasInitializedSelection(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const element = canvasRef.current;
    if (!element) {
      setError('エクスポート対象のキャンバスが見つかりません');
      return;
    }

    let cancelled = false;
    setIsPreparing(true);
    setError(null);
    setSelection(null);
    setHasInitializedSelection(false);

    captureDiagramPreview(element)
      .then((result) => {
        if (cancelled) return;
        setCapture(result);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = (err as Error).message ?? 'PNGプレビューの生成に失敗しました';
        setError(message);
        onStatus?.('error', message);
      })
      .finally(() => {
        if (cancelled) return;
        setIsPreparing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, canvasRef, onStatus]);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setPreviewSize({ width: container.clientWidth, height: container.clientHeight });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [open, capture]);

  useEffect(() => {
    if (!open || !capture) return;
    if (previewSize.width === 0 || previewSize.height === 0) return;
    if (hasInitializedSelection) return;

    const scaleX = previewSize.width / capture.exportWidth;
    const scaleY = previewSize.height / capture.exportHeight;

    if (capture.contentBounds) {
      const marginX = DEFAULT_SELECTION_MARGIN * scaleX;
      const marginY = DEFAULT_SELECTION_MARGIN * scaleY;
      const x = Math.max(0, capture.contentBounds.minX * scaleX - marginX);
      const y = Math.max(0, capture.contentBounds.minY * scaleY - marginY);
      const maxWidth = previewSize.width - x;
      const maxHeight = previewSize.height - y;
      setSelection({
        x,
        y,
        width: Math.min(maxWidth, capture.contentBounds.width * scaleX + marginX * 2),
        height: Math.min(maxHeight, capture.contentBounds.height * scaleY + marginY * 2),
      });
    } else {
      setSelection({ x: 0, y: 0, width: previewSize.width, height: previewSize.height });
    }

    setHasInitializedSelection(true);
    setError(null);
  }, [open, capture, previewSize, hasInitializedSelection]);

  const resetSelection = () => {
    if (!capture || previewSize.width === 0 || previewSize.height === 0) return;
    const scaleX = previewSize.width / capture.exportWidth;
    const scaleY = previewSize.height / capture.exportHeight;

    if (capture.contentBounds) {
      const marginX = DEFAULT_SELECTION_MARGIN * scaleX;
      const marginY = DEFAULT_SELECTION_MARGIN * scaleY;
      const x = Math.max(0, capture.contentBounds.minX * scaleX - marginX);
      const y = Math.max(0, capture.contentBounds.minY * scaleY - marginY);
      const maxWidth = previewSize.width - x;
      const maxHeight = previewSize.height - y;
      setSelection({
        x,
        y,
        width: Math.min(maxWidth, capture.contentBounds.width * scaleX + marginX * 2),
        height: Math.min(maxHeight, capture.contentBounds.height * scaleY + marginY * 2),
      });
    } else {
      setSelection({ x: 0, y: 0, width: previewSize.width, height: previewSize.height });
    }
    setHasInitializedSelection(true);
    setError(null);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!capture || isPreparing || isExporting) return;
    if (event.button !== 0 && event.pointerType !== 'touch' && event.pointerType !== 'pen') return;

    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));

    pointerStartRef.current = { x, y };
    setSelection({ x, y, width: 0, height: 0 });
    setHasInitializedSelection(true);
    setError(null);
    container.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;

    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(event.clientY - rect.top, rect.height));

    const left = Math.min(start.x, currentX);
    const top = Math.min(start.y, currentY);
    const width = Math.abs(currentX - start.x);
    const height = Math.abs(currentY - start.y);

    setSelection({ x: left, y: top, width, height });
    event.preventDefault();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (pointerStartRef.current && selection && (selection.width < 4 || selection.height < 4)) {
      setSelection(null);
    }

    pointerStartRef.current = null;
  };

  const selectionSummary = useMemo(() => {
    if (!capture || !selection || previewSize.width === 0 || previewSize.height === 0) return null;
    if (selection.width <= 0 || selection.height <= 0) return null;

    const scaleX = capture.exportWidth / previewSize.width;
    const scaleY = capture.exportHeight / previewSize.height;

    return {
      width: Math.round(selection.width * scaleX),
      height: Math.round(selection.height * scaleY),
    };
  }, [capture, selection, previewSize]);

  const handleExport = async () => {
    if (!capture) return;
    if (!selection || selection.width < 4 || selection.height < 4 || previewSize.width === 0 || previewSize.height === 0) {
      const message = '出力する範囲をドラッグで選択してください';
      setError(message);
      onStatus?.('error', message);
      return;
    }

    setError(null);
    setIsExporting(true);

    try {
      const scaleX = capture.exportWidth / previewSize.width;
      const scaleY = capture.exportHeight / previewSize.height;
      const selectionForExport = {
        x: selection.x * scaleX,
        y: selection.y * scaleY,
        width: selection.width * scaleX,
        height: selection.height * scaleY,
      };

      await exportCroppedDiagramToPng(capture, selectionForExport, filename);
      onStatus?.('info', 'PNGをダウンロードしました');
      onClose();
    } catch (err) {
      const message = (err as Error).message ?? 'PNG出力に失敗しました';
      setError(message);
      onStatus?.('error', message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="PNGエクスポート" widthClassName="w-full max-w-5xl">
      <div className="space-y-5">
        <p className="text-sm text-slate-600">
          モーダル上のプレビューで出力したい範囲をドラッグして選択してください。選択範囲のみPNGとしてダウンロードします。
        </p>

        {isPreparing && (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border bg-slate-50 text-sm text-slate-500">
            PNGプレビューを生成しています…
          </div>
        )}

        {!isPreparing && capture && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>ドラッグ操作で範囲を決め、右下のボタンからエクスポートします。</span>
              <div className="flex flex-wrap items-center gap-2">
                {selectionSummary && (
                  <span>
                    選択範囲: 幅 {selectionSummary.width.toLocaleString()}px × 高さ {selectionSummary.height.toLocaleString()}px
                  </span>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={resetSelection} disabled={!capture}>
                  全体を選択
                </Button>
              </div>
            </div>
            <div className="overflow-auto rounded-xl border border-border bg-white p-4">
              <div
                ref={containerRef}
                className="relative mx-auto inline-block touch-none select-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <img
                  src={capture.dataUrl}
                  alt="Swimlane preview"
                  className="block h-auto max-h-[60vh] max-w-full rounded-lg shadow-lg"
                />
                {selection && previewSize.width > 0 && previewSize.height > 0 && (
                  <>
                    <div
                      className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                      style={{
                        left: `${selection.x}px`,
                        top: `${selection.y}px`,
                        width: `${selection.width}px`,
                        height: `${selection.height}px`,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute left-0 top-0 right-0 bg-slate-900/30"
                      style={{ height: `${selection.y}px` }}
                    />
                    <div
                      className="pointer-events-none absolute left-0 right-0 bg-slate-900/30"
                      style={{
                        top: `${selection.y + selection.height}px`,
                        height: `${Math.max(0, previewSize.height - (selection.y + selection.height))}px`,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute bg-slate-900/30"
                      style={{
                        left: 0,
                        top: `${selection.y}px`,
                        width: `${selection.x}px`,
                        height: `${selection.height}px`,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute bg-slate-900/30"
                      style={{
                        left: `${selection.x + selection.width}px`,
                        top: `${selection.y}px`,
                        width: `${Math.max(0, previewSize.width - (selection.x + selection.width))}px`,
                        height: `${selection.height}px`,
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {!isPreparing && !capture && !error && (
          <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border bg-slate-50 text-sm text-slate-500">
            プレビューを読み込んでいます…
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isExporting}>
            キャンセル
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={isPreparing || isExporting || !capture}
          >
            {isExporting ? '出力中…' : '選択範囲をPNG出力'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
