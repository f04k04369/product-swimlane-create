'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  captureDiagramPreview,
  exportCroppedDiagramToPng,
  exportDiagramToSvg,
  type DiagramContentBounds,
  type DiagramCaptureResult,
} from '@/lib/export/htmlToImage';
import { useDiagramStore } from '@/state/useDiagramStore';
import {
  computeLaneHeight,
  deriveLanePositionX,
  LANE_PADDING,
  LANE_WIDTH,
  ROW_HEIGHT,
} from '@/lib/diagram/layout';
import { PHASE_GAP_TO_LANE, PHASE_LABEL_MIN_LEFT, PHASE_LABEL_WIDTH } from '@/lib/diagram/constants';
import type { Diagram } from '@/lib/diagram/types';

const DEFAULT_SELECTION_MARGIN = 32;

interface ImageExportDialogProps {
  open: boolean;
  onClose: () => void;
  canvasRef: RefObject<HTMLDivElement>;
  filenameBase: string;
  onStatus?: (type: 'info' | 'error', text: string) => void;
  initialFormat?: 'png' | 'svg';
}

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const computeDiagramContentBounds = (diagram: Diagram): DiagramContentBounds | null => {
  if (!diagram.lanes.length) {
    return null;
  }

  const sortedLanes = [...diagram.lanes].sort((a, b) => a.order - b.order);
  const firstOrder = sortedLanes[0].order;
  const lastOrder = sortedLanes[sortedLanes.length - 1].order;

  const laneLeft = Math.max(0, deriveLanePositionX(sortedLanes, firstOrder) - LANE_PADDING * 0.5);
  const lastLane = sortedLanes.at(-1);
  const laneRight = deriveLanePositionX(sortedLanes, lastOrder) + (lastLane?.width ?? LANE_WIDTH) + LANE_PADDING * 0.5;

  const maxLaneHeight = sortedLanes.reduce((height, lane) => {
    const laneSteps = diagram.steps.filter((step) => step.laneId === lane.id);
    return Math.max(height, computeLaneHeight(laneSteps));
  }, LANE_PADDING * 2 + ROW_HEIGHT);

  const stepsBottom = diagram.steps.length
    ? Math.max(...diagram.steps.map((step) => step.y + step.height))
    : 0;

  const phaseMaxRow = (diagram.phaseGroups ?? []).reduce((acc, phase) => Math.max(acc, phase.endRow), -1);
  const phaseBottom = phaseMaxRow >= 0 ? LANE_PADDING + (phaseMaxRow + 1) * ROW_HEIGHT + LANE_PADDING : 0;

  const contentBottom = Math.max(maxLaneHeight, stepsBottom + LANE_PADDING, phaseBottom);

  const phaseLabelLeft = Math.max(
    PHASE_LABEL_MIN_LEFT,
    deriveLanePositionX(sortedLanes, firstOrder) - PHASE_LABEL_WIDTH - PHASE_GAP_TO_LANE
  );

  const minX = Math.min(phaseLabelLeft, laneLeft);
  const maxX = Math.max(laneRight, phaseLabelLeft + PHASE_LABEL_WIDTH);

  return {
    minX,
    minY: 0,
    width: Math.max(0, maxX - minX),
    height: Math.max(contentBottom, LANE_PADDING * 2 + ROW_HEIGHT),
  };
};

export const ImageExportDialog = ({ open, onClose, canvasRef, filenameBase, onStatus, initialFormat = 'png' }: ImageExportDialogProps) => {
  const resolvedFilenameBase = useMemo(() => {
    const trimmed = filenameBase.trim();
    return trimmed.length > 0 ? trimmed : 'swimlane';
  }, [filenameBase]);

  const diagram = useDiagramStore((state) => state.diagram);
  const [capture, setCapture] = useState<DiagramCaptureResult<string> | null>(null);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [format, setFormat] = useState<'png' | 'svg'>(initialFormat);
  const diagramBounds = useMemo(() => computeDiagramContentBounds(diagram), [diagram]);

  useEffect(() => {
    if (!open) {
      setCapture(null);
      setSelection(null);
      setError(null);
      setHasInitializedSelection(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setFormat(initialFormat);
    }
  }, [open, initialFormat]);

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

    captureDiagramPreview(element, { contentBoundsOverride: diagramBounds })
      .then((result) => {
        if (cancelled) return;
        setCapture(result);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = (err as Error).message ?? 'プレビューの生成に失敗しました';
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
  }, [open, canvasRef, onStatus, diagramBounds]);

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

  const computeExportBounds = useCallback(() => {
    if (!capture || !selection || previewSize.width === 0 || previewSize.height === 0) {
      return null;
    }

    const scaleX = capture.exportWidth / previewSize.width;
    const scaleY = capture.exportHeight / previewSize.height;

    const rawSelection = {
      x: selection.x * scaleX,
      y: selection.y * scaleY,
      width: selection.width * scaleX,
      height: selection.height * scaleY,
    };

    const exportedBounds = capture.contentBounds ?? {
      minX: 0,
      minY: 0,
      width: capture.exportWidth,
      height: capture.exportHeight,
    };

    const normalizedX = Math.max(0, Math.min(rawSelection.x - exportedBounds.minX, exportedBounds.width));
    const normalizedY = Math.max(0, Math.min(rawSelection.y - exportedBounds.minY, exportedBounds.height));
    const maxWidth = Math.max(1, exportedBounds.width - normalizedX);
    const maxHeight = Math.max(1, exportedBounds.height - normalizedY);

    const exportSelection = {
      x: exportedBounds.minX + normalizedX,
      y: exportedBounds.minY + normalizedY,
      width: Math.max(1, Math.min(rawSelection.width, maxWidth)),
      height: Math.max(1, Math.min(rawSelection.height, maxHeight)),
    };

    const baseBounds = capture.baseContentBounds ?? diagramBounds ?? null;
    let baseOverride: DiagramContentBounds | null = null;

    if (baseBounds) {
      const baseMaxWidth = Math.max(1, baseBounds.width - normalizedX);
      const baseMaxHeight = Math.max(1, baseBounds.height - normalizedY);
      baseOverride = {
        minX: baseBounds.minX + normalizedX,
        minY: baseBounds.minY + normalizedY,
        width: Math.max(1, Math.min(exportSelection.width, baseMaxWidth)),
        height: Math.max(1, Math.min(exportSelection.height, baseMaxHeight)),
      };
    }

    return { exportSelection, baseOverride };
  }, [capture, selection, previewSize, diagramBounds]);

  const handleExport = async () => {
    if (!capture) return;
    if (!selection || selection.width < 4 || selection.height < 4 || previewSize.width === 0 || previewSize.height === 0) {
      const message = '出力する範囲をドラッグで選択してください';
      setError(message);
      onStatus?.('error', message);
      return;
    }

    const bounds = computeExportBounds();
    if (!bounds) {
      const message = '選択範囲の計算に失敗しました';
      setError(message);
      onStatus?.('error', message);
      return;
    }

    setError(null);
    setIsExporting(true);

    try {
      if (format === 'png') {
        await exportCroppedDiagramToPng(capture, bounds.exportSelection, `${resolvedFilenameBase}.png`);
        onStatus?.('info', 'PNGをダウンロードしました');
      } else {
        const svgName = (() => {
          return `${resolvedFilenameBase.replace(/\.[^/.]+$/, '')}.svg`;
        })();
        if (!canvasRef.current) {
          throw new Error('エクスポート対象のキャンバスが見つかりません');
        }
        await exportDiagramToSvg(canvasRef.current, svgName, {
          contentBoundsOverride: bounds.baseOverride ?? diagramBounds ?? null,
          diagram,
          padding: 48,
        });
        onStatus?.('info', 'SVGをダウンロードしました');
      }
      onClose();
    } catch (err) {
      const message = (err as Error).message ?? (format === 'png' ? 'PNG出力に失敗しました' : 'SVG出力に失敗しました');
      setError(message);
      onStatus?.('error', message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="図面エクスポート" widthClassName="w-full max-w-5xl">
      <div className="space-y-5">
        <p className="text-sm text-slate-600">
          モーダル上のプレビューで出力したい範囲をドラッグして選択してください。選択範囲のみPNGまたはSVGとしてダウンロードできます。
        </p>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">出力形式</span>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="export-format"
              value="png"
              checked={format === 'png'}
              onChange={() => setFormat('png')}
            />
            PNG（ラスタ画像）
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="export-format"
              value="svg"
              checked={format === 'svg'}
              onChange={() => setFormat('svg')}
            />
            SVG（ベクター）
          </label>
        </div>

        {isPreparing && (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border bg-slate-50 text-sm text-slate-500">
            プレビューを生成しています…
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
                <Image
                  src={capture.data}
                  alt="Swimlane preview"
                  width={capture.exportWidth}
                  height={capture.exportHeight}
                  className="block h-auto max-h-[60vh] max-w-full rounded-lg shadow-lg"
                  unoptimized
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
            {isExporting ? '出力中…' : `選択範囲を${format.toUpperCase()}出力`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
