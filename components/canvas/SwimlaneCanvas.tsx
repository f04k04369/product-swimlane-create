'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent,
  type RefObject,
} from 'react';
import ReactFlow, { Background, Connection, Controls, Edge, MiniMap, Node, type OnMove, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';

import { LaneNode } from '@/components/canvas/LaneNode';
import { LaneHeaderNode } from '@/components/canvas/LaneHeaderNode';
import { LaneBackgroundNode } from '@/components/canvas/LaneBackgroundNode';
import { PhaseLabel } from '@/components/canvas/PhaseLabelNode';
import { StepNode } from '@/components/canvas/StepNode';
import { KeyEdge, type KeyEdgeData } from '@/components/canvas/KeyEdge';
import { useDiagramStore } from '@/state/useDiagramStore';
import {
  COLUMN_WIDTH,
  HORIZONTAL_COLUMN_WIDTH,
  HORIZONTAL_HEADER_WIDTH,
  HORIZONTAL_STEP_GAP,
  computeHorizontalLaneWidth,
  computeLaneHeight,
  deriveLanePositionX,
  deriveLanePositionY,
  LANE_PADDING,
  LANE_WIDTH,
  ROW_HEIGHT,
  columnIndexFromX,
  rowIndexFromY,
} from '@/lib/diagram/layout';
import { PHASE_GAP_TO_LANE, PHASE_LABEL_MIN_LEFT, PHASE_LABEL_WIDTH } from '@/lib/diagram/constants';
import type { PhaseGroup } from '@/lib/diagram/types';


interface PhaseResizeState {
  id: string;
  direction: 'start' | 'end';
}
const nodeTypes = {
  laneBackground: LaneBackgroundNode,
  lane: LaneNode,
  laneHeader: LaneHeaderNode,
  step: StepNode,
};

const edgeTypes = {
  key: KeyEdge,
};

const edgeOptions = {
  animated: false,
  type: 'key' as const,
  updatable: true,
};

interface SwimlaneCanvasProps {
  canvasRef: RefObject<HTMLDivElement>;
}

export const SwimlaneCanvas = ({ canvasRef }: SwimlaneCanvasProps) => {
  const diagram = useDiagramStore((state) => state.diagram);
  const selection = useDiagramStore((state) => state.selection);
  const selectedPhaseIds = useMemo(() => selection.phases ?? [], [selection.phases]);
  const moveStep = useDiagramStore((state) => state.moveStep);
  const addConnection = useDiagramStore((state) => state.addConnection);
  const removeConnection = useDiagramStore((state) => state.removeConnection);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const clearSelection = useDiagramStore((state) => state.clearSelection);
  const updateConnectionEndpoints = useDiagramStore((state) => state.updateConnectionEndpoints);
  const pendingInsert = useDiagramStore((state) => state.pendingInsert);
  const setPendingInsert = useDiagramStore((state) => state.setPendingInsert);
  const clearPendingInsert = useDiagramStore((state) => state.clearPendingInsert);
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const scrollToTopCounter = useDiagramStore((state) => state.scrollToTopCounter);
  const addPhaseGroup = useDiagramStore((state) => state.addPhaseGroup);
  const updatePhaseGroup = useDiagramStore((state) => state.updatePhaseGroup);
  const { project, setViewport, getViewport } = useReactFlow();
  const [phaseResize, setPhaseResize] = useState<PhaseResizeState | null>(null);
  const [selectedPhaseRow, setSelectedPhaseRow] = useState<number | null>(null);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const pane = container.querySelector<HTMLElement>('.react-flow__pane');
    if (!pane) return;
    const previousCursor = pane.style.cursor;
    pane.style.cursor = isSpacePanning ? 'grab' : 'default';
    return () => {
      pane.style.cursor = previousCursor;
    };
  }, [canvasRef, isSpacePanning]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      setIsSpacePanning((prev) => {
        if (prev) return prev;
        event.preventDefault();
        return true;
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      setIsSpacePanning(false);
    };

    const handleWindowBlur = () => {
      setIsSpacePanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  const laneMap = useMemo(() => {
    const map = new Map<string, { title: string; color: string; order: number }>();
    diagram.lanes.forEach((lane) => {
      map.set(lane.id, { title: lane.title, color: lane.color, order: lane.order });
    });
    return map;
  }, [diagram.lanes]);

  const sortedLanes = useMemo(() => diagram.lanes.slice().sort((a, b) => a.order - b.order), [diagram.lanes]);

  const orientation = diagram.orientation ?? 'vertical';
  const isHorizontal = orientation === 'horizontal';
  const rowSize = isHorizontal ? HORIZONTAL_COLUMN_WIDTH : ROW_HEIGHT;

  const laneSpans = useMemo(() => {
    const map = new Map<string, number>();
    diagram.lanes.forEach((lane) => {
      const laneSteps = diagram.steps.filter((step) => step.laneId === lane.id);
      map.set(
        lane.id,
        isHorizontal ? computeHorizontalLaneWidth(laneSteps) : computeLaneHeight(laneSteps)
      );
    });
    return map;
  }, [diagram.lanes, diagram.steps, isHorizontal]);

  const minimumSpan = isHorizontal ? rowSize : LANE_PADDING * 2 + rowSize;

  const horizontalHeaderWidth = HORIZONTAL_HEADER_WIDTH;
  const laneContentOffsetX = isHorizontal ? horizontalHeaderWidth : 0;
  const lanePaddingValue = LANE_PADDING;

  const handleLaneRowSelect = useCallback(
    (laneId: string, row: number) => {
      if (isSpacePanning) return;
      setPendingInsert(laneId, row);
      setSelection({ lanes: [laneId], steps: [], connections: [] });
    },
    [isSpacePanning, setPendingInsert, setSelection]
  );

  const laneNodes: Node[] = useMemo(() => {
    return sortedLanes.map((lane) => {
      const primarySpan = laneSpans.get(lane.id) ?? minimumSpan;
      const isSelected = selection.lanes.includes(lane.id);
      if (isHorizontal) {
        return {
          id: `lane-${lane.id}`,
          type: 'lane',
          position: { x: laneContentOffsetX, y: deriveLanePositionY(sortedLanes, lane.order) },
          data: {
            id: lane.id,
            title: lane.title,
            color: lane.color,
            height: lane.width,
            width: primarySpan,
            isSelected,
            pendingRow: pendingInsert?.laneId === lane.id ? pendingInsert.row : null,
            rowHeight: rowSize,
            highlightWidth: COLUMN_WIDTH,
            lanePadding: lanePaddingValue,
            orientation,
            onRowHandleClick: handleLaneRowSelect,
          },
          selectable: false,
          draggable: false,
          zIndex: 0,
        } satisfies Node;
      }
      return {
        id: `lane-${lane.id}`,
        type: 'lane',
        position: { x: deriveLanePositionX(sortedLanes, lane.order), y: 0 },
        data: {
          id: lane.id,
          title: lane.title,
          color: lane.color,
          height: primarySpan,
          width: lane.width,
          isSelected,
          pendingRow: pendingInsert?.laneId === lane.id ? pendingInsert.row : null,
          rowHeight: rowSize,
          lanePadding: lanePaddingValue,
          orientation,
          onRowHandleClick: handleLaneRowSelect,
        },
        selectable: false,
        draggable: false,
        zIndex: 0,
      } satisfies Node;
    });
  }, [
    handleLaneRowSelect,
    isHorizontal,
    laneContentOffsetX,
    laneSpans,
    minimumSpan,
    orientation,
    pendingInsert,
    lanePaddingValue,
    rowSize,
    selection.lanes,
    sortedLanes,
  ]);

  const laneHeaderNodes: Node[] = useMemo(() => {
    return sortedLanes.map((lane) => {
      if (isHorizontal) {
        return {
          id: `lane-header-${lane.id}`,
          type: 'laneHeader',
          position: { x: 0, y: deriveLanePositionY(sortedLanes, lane.order) },
          data: {
            id: lane.id,
            title: lane.title,
            color: lane.color,
            width: horizontalHeaderWidth,
            height: lane.width,
            isSelected: selection.lanes.includes(lane.id),
            orientation,
          },
          selectable: false,
          draggable: false,
          focusable: false,
          zIndex: 10,
        } satisfies Node;
      }
      return {
        id: `lane-header-${lane.id}`,
        type: 'laneHeader',
        position: { x: deriveLanePositionX(sortedLanes, lane.order), y: 0 },
        data: {
          id: lane.id,
          title: lane.title,
          color: lane.color,
          width: lane.width,
          height: ROW_HEIGHT,
          isSelected: selection.lanes.includes(lane.id),
          orientation,
        },
        selectable: false,
        draggable: false,
        focusable: false,
        zIndex: 10,
      } satisfies Node;
    });
  }, [horizontalHeaderWidth, isHorizontal, orientation, selection.lanes, sortedLanes]);

  const projectPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return null;
      const bounds = canvasRef.current.getBoundingClientRect();
      return project({ x: clientX - bounds.left, y: clientY - bounds.top });
    },
    [canvasRef, project]
  );

  const selectLaneRow = useCallback(
    (laneId: string, position: { x: number; y: number }) => {
      if (isHorizontal) {
        if (position.x < laneContentOffsetX) {
          handleLaneRowSelect(laneId, 0);
          setSelectedPhaseRow(0);
          return;
        }
        const base = position.x - laneContentOffsetX - lanePaddingValue;
        const column = Math.max(0, Math.floor(base / rowSize));
        handleLaneRowSelect(laneId, column);
        setSelectedPhaseRow(column);
      } else {
        const base = position.y;
        const row = Math.max(0, Math.floor((base - lanePaddingValue) / rowSize));
        handleLaneRowSelect(laneId, row);
        setSelectedPhaseRow(row);
      }
    },
    [handleLaneRowSelect, isHorizontal, laneContentOffsetX, lanePaddingValue, rowSize]
  );

  const stepNodes: Node[] = useMemo(
    () =>
      diagram.steps.map((step) => {
        const lane = laneMap.get(step.laneId);
        return {
          id: step.id,
          type: 'step',
          position: { x: step.x, y: step.y },
          data: {
            id: step.id,
            title: step.title,
            description: step.description,
            color: step.color,
            fillColor: step.fillColor,
            laneColor: lane?.color ?? '#0ea5e9',
            laneId: step.laneId,
            onSelect: (id: string) =>
              setSelection({ lanes: lane ? [step.laneId] : [], steps: [id], connections: [] }),
            width: step.width,
            height: step.height,
            kind: step.kind,
            order: step.order,
            orientation,
          },
          width: step.width,
          height: step.height,
          selectable: true,
          draggable: true,
          zIndex: 2,
          selected: selection.steps.includes(step.id),
        } satisfies Node;
      }),
    [diagram.steps, laneMap, orientation, selection.steps, setSelection]
  );

  const canvasPrimarySpan = useMemo(() => {
    if (!diagram.lanes.length) return minimumSpan;
    return Math.max(...diagram.lanes.map((lane) => laneSpans.get(lane.id) ?? minimumSpan));
  }, [diagram.lanes, laneSpans, minimumSpan]);

  const contentPrimarySpan = useMemo(() => {
    if (!diagram.steps.length) return canvasPrimarySpan;
    if (isHorizontal) {
      const maxRight =
        Math.max(
          ...diagram.steps.map((step) => step.x + step.width - laneContentOffsetX)
        ) || 0;
      return Math.max(canvasPrimarySpan, maxRight + HORIZONTAL_STEP_GAP);
    }
    const maxCoordinate = Math.max(...diagram.steps.map((step) => step.y + step.height));
    return Math.max(canvasPrimarySpan, maxCoordinate + LANE_PADDING);
  }, [
    canvasPrimarySpan,
    diagram.steps,
    isHorizontal,
    laneContentOffsetX,
  ]);

  const diagramPrimarySpan = useMemo(
    () => Math.max(canvasPrimarySpan, contentPrimarySpan),
    [canvasPrimarySpan, contentPrimarySpan]
  );

  const laneArea = useMemo(() => {
    if (!sortedLanes.length) return null;
    if (isHorizontal) {
      const firstOrder = sortedLanes[0].order;
      const lastOrder = sortedLanes[sortedLanes.length - 1].order;
      const top = deriveLanePositionY(sortedLanes, firstOrder);
      const lastLane = sortedLanes[sortedLanes.length - 1];
      const bottom = deriveLanePositionY(sortedLanes, lastOrder) + lastLane.width;
      const height = Math.max(bottom - top, LANE_WIDTH);
      const width = Math.max(diagramPrimarySpan, minimumSpan);
      return {
        left: laneContentOffsetX,
        top,
        width,
        height,
      };
    }
    const firstOrder = sortedLanes[0].order;
    const lastOrder = sortedLanes[sortedLanes.length - 1].order;
    const left = Math.max(0, deriveLanePositionX(sortedLanes, firstOrder) - LANE_PADDING * 0.5);
    const lastLane = sortedLanes[sortedLanes.length - 1];
    const right = deriveLanePositionX(sortedLanes, lastOrder) + lastLane.width + LANE_PADDING * 0.5;
    return {
      left,
      top: 0,
      width: Math.max(right - left, LANE_WIDTH + LANE_PADDING),
      height: diagramPrimarySpan,
    };
  }, [diagramPrimarySpan, isHorizontal, laneContentOffsetX, minimumSpan, sortedLanes]);

  const canvasMinHeight = useMemo(() => {
    if (isHorizontal) {
      const baseHeight = (laneArea?.top ?? 0) + (laneArea?.height ?? 0);
      return Math.max(baseHeight, diagramPrimarySpan);
    }
    return diagramPrimarySpan;
  }, [diagramPrimarySpan, isHorizontal, laneArea]);

  const maxRow = useMemo(() => {
    if (isHorizontal) {
      return Math.max(0, Math.ceil(contentPrimarySpan / rowSize) - 1);
    }
    return Math.max(0, Math.ceil((contentPrimarySpan - LANE_PADDING) / rowSize) - 1);
  }, [contentPrimarySpan, isHorizontal, rowSize]);

  const laneAreaLeft = laneArea?.left ?? 16;

  const stepRowIndices = useMemo(() => {
    return diagram.steps.map((step) => {
      if (typeof step.order === 'number' && Number.isFinite(step.order)) {
        return Math.max(0, Math.round(step.order));
      }
      return Math.max(
        0,
        isHorizontal
          ? columnIndexFromX(step.x - horizontalHeaderWidth, step.width)
          : rowIndexFromY(step.y, step.height)
      );
    });
  }, [diagram.steps, horizontalHeaderWidth, isHorizontal]);

  const maxStepRow = useMemo(() => {
    if (!stepRowIndices.length) return -1;
    return Math.max(...stepRowIndices);
  }, [stepRowIndices]);

  const firstLaneLeft = useMemo(() => {
    if (!sortedLanes.length) {
      return laneAreaLeft;
    }
    return deriveLanePositionX(sortedLanes, sortedLanes[0].order);
  }, [laneAreaLeft, sortedLanes]);

  const phaseLabelX = useMemo(() => {
    if (!sortedLanes.length) {
      return Math.max(PHASE_LABEL_MIN_LEFT, laneAreaLeft + 8);
    }
    return Math.max(PHASE_LABEL_MIN_LEFT, firstLaneLeft - PHASE_LABEL_WIDTH - PHASE_GAP_TO_LANE);
  }, [firstLaneLeft, laneAreaLeft, sortedLanes.length]);

  const phaseGroups = useMemo(() => (isHorizontal ? [] : diagram.phaseGroups ?? []), [diagram.phaseGroups, isHorizontal]);

  const maxRowLimit = useMemo(() => Math.max(maxRow, maxStepRow), [maxRow, maxStepRow]);

  const hasStepsInRange = useCallback(
    (start: number, end: number) => {
      if (!stepRowIndices.length) return false;
      const normalizedStart = Math.min(start, end);
      const normalizedEnd = Math.max(start, end);
      return stepRowIndices.some((row) => row >= normalizedStart && row <= normalizedEnd);
    },
    [stepRowIndices]
  );

  const phaseMaxRow = useMemo(
    () => phaseGroups.reduce((acc, phase) => Math.max(acc, phase.endRow), -1),
    [phaseGroups]
  );

  const phaseAddButtonY = useMemo(() => {
    if (phaseMaxRow >= 0) {
      return LANE_PADDING + (phaseMaxRow + 1) * rowSize + 16;
    }
    return LANE_PADDING - 64;
  }, [phaseMaxRow, rowSize]);

  const [viewportState, setViewportState] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    setViewportState(getViewport());
  }, [getViewport]);

  const effectiveMaxRow = useMemo(
    () => Math.max(maxRowLimit, phaseMaxRow),
    [maxRowLimit, phaseMaxRow]
  );

  const rowForNewPhase = useMemo(
    () => (selectedPhaseRow === null ? null : Math.max(0, Math.min(selectedPhaseRow, effectiveMaxRow))),
    [effectiveMaxRow, selectedPhaseRow]
  );

  const rowAlreadyHasPhase = useMemo(
    () => (rowForNewPhase === null ? false : phaseGroups.some((phase) => rowForNewPhase >= phase.startRow && rowForNewPhase <= phase.endRow)),
    [phaseGroups, rowForNewPhase]
  );

  const canAddPhase = useMemo(() => {
    if (rowForNewPhase === null) return false;
    if (rowAlreadyHasPhase) return false;
    if (!hasStepsInRange(rowForNewPhase, rowForNewPhase)) return false;
    return true;
  }, [hasStepsInRange, rowAlreadyHasPhase, rowForNewPhase]);

  const phaseAddMessage = useMemo(() => {
    if (rowForNewPhase === null) return 'フェーズ化したい行をクリックしてください。';
    if (rowAlreadyHasPhase) return `行${rowForNewPhase + 1}には既にフェーズがあります。`;
    if (!hasStepsInRange(rowForNewPhase, rowForNewPhase)) return `行${rowForNewPhase + 1}にステップがありません。`;
    return undefined;
  }, [hasStepsInRange, rowAlreadyHasPhase, rowForNewPhase]);

  const clampRow = useCallback((row: number) => Math.max(0, Math.min(row, effectiveMaxRow)), [effectiveMaxRow]);

  const rowFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const projected = projectPointer(clientX, clientY);
      if (!projected) return 0;
      if (isHorizontal) {
        const diagramX = projected.x - laneContentOffsetX - lanePaddingValue;
        const column = Math.floor(diagramX / rowSize);
        return Number.isFinite(column) ? Math.max(0, column) : 0;
      }
      const diagramY = projected.y;
      const row = Math.floor((diagramY - lanePaddingValue) / rowSize);
      return Number.isFinite(row) ? Math.max(0, row) : 0;
    },
    [isHorizontal, laneContentOffsetX, lanePaddingValue, projectPointer, rowSize]
  );

  const laneBackground = useMemo(() => {
    if (!laneArea || !sortedLanes.length) return [];
    return [
      {
        id: 'lane-background',
        type: 'laneBackground',
        position: { x: laneArea.left, y: laneArea.top ?? 0 },
        data: { width: laneArea.width, height: laneArea.height ?? diagramPrimarySpan },
        selectable: false,
        draggable: false,
        zIndex: -1,
      } satisfies Node,
    ];
  }, [diagramPrimarySpan, laneArea, sortedLanes.length]);

  const openPhaseEditor = useCallback(
    (phase: PhaseGroup) => {
      setSelection({ lanes: [], steps: [], connections: [], phases: [phase.id] });
    },
    [setSelection]
  );

  const handlePhaseResizeStart = useCallback(
    (phaseId: string, direction: 'start' | 'end', event: ReactPointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      setPhaseResize({ id: phaseId, direction });
      setSelection({ lanes: [], steps: [], connections: [], phases: [phaseId] });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [setSelection]
  );

  const handleAddPhase = useCallback(() => {
    if (rowForNewPhase === null || !canAddPhase) {
      return;
    }
    const clamped = clampRow(rowForNewPhase);
    const newId = addPhaseGroup(clamped, clamped, '');
    setSelectedPhaseRow(null);
    setSelection({ lanes: [], steps: [], connections: [], phases: [newId] });
  }, [addPhaseGroup, canAddPhase, clampRow, rowForNewPhase, setSelection]);

  useEffect(() => {
    if (!phaseResize) return;
    const handlePointerMove = (event: PointerEvent) => {
      const rawRow = rowFromPointer(event.clientX, event.clientY);
      const row = clampRow(rawRow);
      const phase = diagram.phaseGroups?.find((item) => item.id === phaseResize.id);
      if (!phase) return;
      if (phaseResize.direction === 'start') {
        const nextStart = Math.min(row, phase.endRow);
        if (nextStart !== phase.startRow) {
          updatePhaseGroup(phase.id, { startRow: nextStart });
        }
      } else {
        const nextEnd = Math.max(row, phase.startRow);
        if (nextEnd !== phase.endRow) {
          updatePhaseGroup(phase.id, { endRow: nextEnd });
        }
      }
    };
    const handlePointerUp = () => {
      setPhaseResize(null);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [clampRow, diagram.phaseGroups, phaseResize, rowFromPointer, updatePhaseGroup]);

  const nodes = useMemo(
    () => [...laneBackground, ...laneNodes, ...stepNodes, ...laneHeaderNodes],
    [laneBackground, laneHeaderNodes, laneNodes, stepNodes]
  );

  const renderPhaseOverlay = useCallback(() => {
    if (!laneArea || isHorizontal) return null;
    return (
      <div
        className="absolute z-20"
        data-phase-overlay="true"
        style={{
          left: 0,
          top: 0,
          transform: `translate(${viewportState.x}px, ${viewportState.y}px) scale(${viewportState.zoom})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}
      >
        {phaseGroups.map((phase) => {
          const top = LANE_PADDING + phase.startRow * rowSize;
          const height = Math.max(rowSize, (phase.endRow - phase.startRow + 1) * rowSize);
          const isActive = selectedPhaseIds.includes(phase.id) || phaseResize?.id === phase.id;
          return (
            <div
              key={phase.id}
              className="flex justify-center"
              style={{ position: 'absolute', left: phaseLabelX, top, width: PHASE_LABEL_WIDTH, height, pointerEvents: 'auto' }}
            >
              <PhaseLabel
                id={phase.id}
                title={phase.title}
                width={PHASE_LABEL_WIDTH}
                height={height}
                orientation={orientation}
                isActive={isActive}
                onEdit={() => openPhaseEditor(phase)}
                onResizeStart={handlePhaseResizeStart}
              />
            </div>
          );
        })}
        <div
          className="flex flex-col items-center"
          style={{ position: 'absolute', left: phaseLabelX, top: phaseAddButtonY, width: PHASE_LABEL_WIDTH, pointerEvents: 'auto' }}
        >
          <button
            type="button"
            className={`pointer-events-auto flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-2 py-4 text-xs font-semibold shadow-sm transition-all duration-150 ease-out ${canAddPhase
              ? 'border-blue-400 bg-white/70 text-blue-600 hover:-translate-y-[1px] hover:bg-blue-50'
              : 'cursor-not-allowed border-slate-300 bg-white/40 text-slate-400'
              }`}
            onClick={() => {
              if (!canAddPhase) return;
              handleAddPhase();
            }}
            disabled={!canAddPhase}
          >
            <span className="text-base leading-none">＋</span>
            <span className="tracking-widest" style={{ writingMode: 'vertical-rl' }}>
              {phaseGroups.length ? 'フェーズ追加' : 'フェーズ作成'}
            </span>
          </button>
          {phaseAddMessage && (
            <span className="mt-2 w-full rounded-md bg-rose-50 px-2 py-1 text-center text-[10px] font-medium text-rose-500 shadow-sm">
              {phaseAddMessage}
            </span>
          )}
        </div>
      </div>
    );
  }, [
    canAddPhase,
    handleAddPhase,
    handlePhaseResizeStart,
    isHorizontal,
    laneArea,
    orientation,
    phaseAddButtonY,
    phaseGroups,
    phaseLabelX,
    phaseResize?.id,
    phaseAddMessage,
    rowSize,
    viewportState.x,
    viewportState.y,
    viewportState.zoom,
    openPhaseEditor,
    selectedPhaseIds,
  ]);

  const handleViewportChange = useCallback<OnMove>((_event, viewport) => {
    setViewportState(viewport);
  }, []);

  useEffect(() => {
    if (!scrollToTopCounter) return;
    const { x, zoom } = getViewport();
    const target = { x, y: 0, zoom };
    setViewport(target, { duration: 300 });
    setViewportState(target);
  }, [getViewport, scrollToTopCounter, setViewport]);

  const edges: Edge<KeyEdgeData>[] = useMemo(
    () =>
      diagram.connections.map((connection) => ({
        id: connection.id,
        type: 'key',
        source: connection.sourceId,
        target: connection.targetId,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        data: {
          label: connection.label ?? '',
          control: connection.control ?? null,
          startMarker: connection.startMarker ?? 'none',
          endMarker: connection.endMarker ?? 'arrow',
          markerSize: connection.markerSize ?? 16,
        },
        style: { stroke: '#2563eb', strokeWidth: 2 },
        selectable: true,
        focusable: true,
        selected: selection.connections.includes(connection.id),
      })),
    [diagram.connections, selection.connections]
  );

  const handleNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      if (node.type !== 'step') return;
      moveStep(node.id, node.position.x, node.position.y);
      const { diagram: latestDiagram } = useDiagramStore.getState();
      const moved = latestDiagram.steps.find((step) => step.id === node.id);
      clearPendingInsert();
      setSelection({ lanes: moved ? [moved.laneId] : [], steps: [node.id], connections: [] });
    },
    [clearPendingInsert, moveStep, setSelection]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const { diagram: current } = useDiagramStore.getState();
      const existing = current.connections.find(
        (edge) =>
          edge.sourceId === connection.source &&
          edge.targetId === connection.target &&
          (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
          (edge.targetHandle ?? null) === (connection.targetHandle ?? null)
      );
      if (existing) {
        clearPendingInsert();
        setSelection({ lanes: [], steps: [], connections: [existing.id] });
        return;
      }
      addConnection(connection.source, connection.target, connection.sourceHandle ?? null, connection.targetHandle ?? null);
      const { diagram: latest } = useDiagramStore.getState();
      const created = latest.connections.find(
        (edge) =>
          edge.sourceId === connection.source &&
          edge.targetId === connection.target &&
          (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
          (edge.targetHandle ?? null) === (connection.targetHandle ?? null)
      );
      if (created) {
        clearPendingInsert();
        setSelection({ lanes: [], steps: [], connections: [created.id] });
      }
    },
    [addConnection, clearPendingInsert, setSelection]
  );

  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge<KeyEdgeData>[]) => {
      deletedEdges.forEach((edge) => {
        removeConnection(edge.id);
      });
      clearSelection();
      clearPendingInsert();
    },
    [clearPendingInsert, clearSelection, removeConnection]
  );

  const handleEdgeClick = useCallback(
    (event: MouseEvent, edge: Edge<KeyEdgeData>) => {
      event.stopPropagation();
      clearPendingInsert();
      setSelection({ lanes: [], steps: [], connections: [edge.id] });
    },
    [clearPendingInsert, setSelection]
  );

  const handleEdgeUpdate = useCallback(
    (oldEdge: Edge<KeyEdgeData>, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target) return;
      updateConnectionEndpoints(oldEdge.id, {
        sourceId: newConnection.source,
        targetId: newConnection.target,
        sourceHandle: newConnection.sourceHandle ?? null,
        targetHandle: newConnection.targetHandle ?? null,
      });
      clearPendingInsert();
      setSelection({ lanes: [], steps: [], connections: [oldEdge.id] });
    },
    [clearPendingInsert, setSelection, updateConnectionEndpoints]
  );

  const handleEdgeUpdateStart = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge<KeyEdgeData>) => {
      clearPendingInsert();
      setSelection({ lanes: [], steps: [], connections: [edge.id] });
    },
    [clearPendingInsert, setSelection]
  );

  const handleEdgeUpdateEnd = useCallback(() => {
    // no-op: React Flow handles final connection, state already updated via handleEdgeUpdate
  }, []);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge<KeyEdgeData>[] }) => {
      const manualEdge = selectedEdges.at(0);
      if (manualEdge) {
        clearPendingInsert();
        setSelection({ lanes: [], steps: [], connections: [manualEdge.id] });
        return;
      }
      const stepNode = selectedNodes.find((node) => node.type === 'step');
      if (stepNode) {
        const laneId = (stepNode.data as { laneId?: string } | undefined)?.laneId;
        setSelection({ lanes: laneId ? [laneId] : [], steps: [stepNode.id], connections: [] });
        return;
      }
      const { pendingInsert: currentPending } = useDiagramStore.getState();
      if (currentPending) {
        setSelection({ lanes: [currentPending.laneId], steps: [], connections: [] });
        return;
      }
      clearSelection();
      clearPendingInsert();
    },
    [clearPendingInsert, clearSelection, setSelection]
  );

  const handlePaneClick = useCallback(
    (event: MouseEvent) => {
      if (isSpacePanning) return;
      const projected = projectPointer(event.clientX, event.clientY);
      if (!projected) {
        clearSelection();
        clearPendingInsert();
        return;
      }
      const lane = sortedLanes.find((candidate) => {
        if (isHorizontal) {
          const yStart = deriveLanePositionY(sortedLanes, candidate.order);
          const yEnd = yStart + candidate.width;
          return projected.y >= yStart && projected.y <= yEnd;
        }
        const xStart = deriveLanePositionX(sortedLanes, candidate.order);
        const xEnd = xStart + candidate.width;
        return projected.x >= xStart && projected.x <= xEnd;
      });
      if (lane) {
        selectLaneRow(lane.id, projected);
      } else {
        clearSelection();
        clearPendingInsert();
        setSelectedPhaseRow(null);
      }
    },
    [
      clearPendingInsert,
      clearSelection,
      isHorizontal,
      isSpacePanning,
      projectPointer,
      selectLaneRow,
      sortedLanes,
    ]
  );

  const handleNodeClick = useCallback(
    (event: MouseEvent, node: Node) => {
      if (isSpacePanning) return;
      event.stopPropagation();
      if (node.type === 'lane' || node.type === 'laneHeader') {
        const laneId = (node.data as { id?: string })?.id;
        if (!laneId) return;
        const projected = projectPointer(event.clientX, event.clientY);
        if (!projected) return;
        selectLaneRow(laneId, projected);
        return;
      }
      if (node.type !== 'step') return;
      const laneId = (node.data as { laneId?: string } | undefined)?.laneId;
      clearPendingInsert();
      setSelection({ lanes: laneId ? [laneId] : [], steps: [node.id], connections: [] });
    },
    [clearPendingInsert, isSpacePanning, projectPointer, selectLaneRow, setSelection]
  );

  return (
    <div
      ref={canvasRef}
      className="relative flex-1 bg-slate-50"
      style={{
        minHeight: canvasMinHeight,
        cursor: isSpacePanning ? 'grab' : 'default',
      }}
    >
      {renderPhaseOverlay()}
      <ReactFlow
        className={`h-full w-full ${isSpacePanning ? 'cursor-grab' : 'cursor-default'}`}
        style={{ minHeight: canvasMinHeight, zIndex: 1 }}
        onConnectStart={() => { }}
        onConnectEnd={() => { }}
        connectOnClick
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={edgeOptions}
        panOnDrag={isSpacePanning}
        minZoom={0.01}
        maxZoom={10}
        panOnScroll
        zoomOnScroll
        zoomActivationKeyCode={null}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onEdgeUpdate={handleEdgeUpdate}
        onEdgeUpdateStart={handleEdgeUpdateStart}
        onEdgeUpdateEnd={handleEdgeUpdateEnd}
        onEdgesDelete={handleEdgesDelete}
        onPaneClick={handlePaneClick}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onSelectionChange={handleSelectionChange}
        onMove={handleViewportChange}
        edgeUpdaterRadius={16}
      >
        <Background gap={24} size={1} color="#e5e7eb" />
        <Controls position="top-left" showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
};
