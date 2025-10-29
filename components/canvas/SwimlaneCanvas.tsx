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
import { computeLaneHeight, deriveLanePositionX, LANE_PADDING, LANE_WIDTH, ROW_HEIGHT, rowIndexFromY } from '@/lib/diagram/layout';
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

  const laneHeights = useMemo(() => {
    const map = new Map<string, number>();
    diagram.lanes.forEach((lane) => {
      const laneSteps = diagram.steps.filter((step) => step.laneId === lane.id);
      map.set(lane.id, computeLaneHeight(laneSteps));
    });
    return map;
  }, [diagram.lanes, diagram.steps]);

  const minimumHeight = LANE_PADDING * 2 + ROW_HEIGHT;

  const handleLaneRowSelect = useCallback(
    (laneId: string, row: number) => {
      if (isSpacePanning) return;
      setPendingInsert(laneId, row);
      setSelection({ lanes: [laneId], steps: [], connections: [] });
    },
    [isSpacePanning, setPendingInsert, setSelection]
  );

  const laneNodes: Node[] = useMemo(
    () =>
      sortedLanes.map((lane) => ({
        id: `lane-${lane.id}`,
        type: 'lane',
        position: { x: deriveLanePositionX(lane.order), y: 0 },
        data: {
          id: lane.id,
          title: lane.title,
          color: lane.color,
          height: laneHeights.get(lane.id) ?? minimumHeight,
          width: LANE_WIDTH,
          pendingRow: pendingInsert?.laneId === lane.id ? pendingInsert.row : null,
          rowHeight: ROW_HEIGHT,
          lanePadding: LANE_PADDING,
          onRowHandleClick: handleLaneRowSelect,
        },
        selectable: false,
        draggable: false,
        zIndex: 0,
      })),
    [handleLaneRowSelect, laneHeights, minimumHeight, pendingInsert, sortedLanes]
  );

  const laneHeaderNodes: Node[] = useMemo(
    () =>
      sortedLanes.map((lane) => ({
        id: `lane-header-${lane.id}`,
        type: 'laneHeader',
        position: { x: deriveLanePositionX(lane.order), y: 0 },
        data: {
          id: lane.id,
          title: lane.title,
          color: lane.color,
          width: LANE_WIDTH,
          isSelected: selection.lanes.includes(lane.id),
        },
        selectable: false,
        draggable: false,
        focusable: false,
        zIndex: 10,
      })),
    [selection.lanes, sortedLanes]
  );

  const projectPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return null;
      const bounds = canvasRef.current.getBoundingClientRect();
      return project({ x: clientX - bounds.left, y: clientY - bounds.top });
    },
    [canvasRef, project]
  );

  const selectLaneRow = useCallback(
    (laneId: string, diagramY: number) => {
      const row = Math.max(0, Math.floor((diagramY - LANE_PADDING) / ROW_HEIGHT));
      handleLaneRowSelect(laneId, row);
      setSelectedPhaseRow(row);
    },
    [handleLaneRowSelect]
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
            laneColor: lane?.color ?? '#0ea5e9',
            laneId: step.laneId,
            onSelect: (id: string) =>
              setSelection({ lanes: lane ? [step.laneId] : [], steps: [id], connections: [] }),
            width: step.width,
            height: step.height,
            kind: step.kind,
            order: step.order,
          },
          width: step.width,
          height: step.height,
          selectable: true,
          draggable: true,
          zIndex: 2,
          selected: selection.steps.includes(step.id),
        } satisfies Node;
      }),
    [diagram.steps, laneMap, selection.steps, setSelection]
  );

  const canvasHeight = useMemo(() => {
    if (!diagram.lanes.length) return minimumHeight;
    return Math.max(...diagram.lanes.map((lane) => laneHeights.get(lane.id) ?? minimumHeight));
  }, [diagram.lanes, laneHeights, minimumHeight]);

  const laneArea = useMemo(() => {
    if (!sortedLanes.length) return null;
    const firstOrder = sortedLanes[0].order;
    const lastOrder = sortedLanes[sortedLanes.length - 1].order;
    const left = Math.max(0, deriveLanePositionX(firstOrder) - LANE_PADDING * 0.5);
    const right = deriveLanePositionX(lastOrder) + LANE_WIDTH + LANE_PADDING * 0.5;
    return {
      left,
      width: Math.max(right - left, LANE_WIDTH + LANE_PADDING),
    };
  }, [sortedLanes]);

  const contentHeight = useMemo(() => {
    if (!diagram.steps.length) return canvasHeight;
    const maxBottom = Math.max(...diagram.steps.map((step) => step.y + step.height));
    return Math.max(canvasHeight, maxBottom + LANE_PADDING);
  }, [canvasHeight, diagram.steps]);

  const maxRow = useMemo(() => Math.max(0, Math.ceil((contentHeight - LANE_PADDING) / ROW_HEIGHT) - 1), [contentHeight]);

  const laneAreaLeft = laneArea?.left ?? 16;

  const stepRowIndices = useMemo(() => {
    return diagram.steps.map((step) => {
      if (typeof step.order === 'number' && Number.isFinite(step.order)) {
        return Math.max(0, Math.round(step.order));
      }
      return Math.max(0, rowIndexFromY(step.y, step.height));
    });
  }, [diagram.steps]);

  const maxStepRow = useMemo(() => {
    if (!stepRowIndices.length) return -1;
    return Math.max(...stepRowIndices);
  }, [stepRowIndices]);

  const firstLaneLeft = useMemo(() => {
    if (!sortedLanes.length) {
      return laneAreaLeft;
    }
    return deriveLanePositionX(sortedLanes[0].order);
  }, [laneAreaLeft, sortedLanes]);

  const phaseLabelX = useMemo(() => {
    if (!sortedLanes.length) {
      return Math.max(PHASE_LABEL_MIN_LEFT, laneAreaLeft + 8);
    }
    return Math.max(PHASE_LABEL_MIN_LEFT, firstLaneLeft - PHASE_LABEL_WIDTH - PHASE_GAP_TO_LANE);
  }, [firstLaneLeft, laneAreaLeft, sortedLanes.length]);

  const phaseGroups = useMemo(() => diagram.phaseGroups ?? [], [diagram.phaseGroups]);

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
      return LANE_PADDING + (phaseMaxRow + 1) * ROW_HEIGHT + 16;
    }
    return LANE_PADDING - 64;
  }, [phaseMaxRow]);

  const diagramHeight = useMemo(() => Math.max(canvasHeight, contentHeight), [canvasHeight, contentHeight]);

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
      const diagramY = projected.y;
      const row = Math.floor((diagramY - LANE_PADDING) / ROW_HEIGHT);
      return Number.isFinite(row) ? row : 0;
    },
    [projectPointer]
  );

  const laneBackground = useMemo(() => {
    if (!laneArea || !sortedLanes.length) return [];
    const height = diagramHeight;
    return [
      {
        id: 'lane-background',
        type: 'laneBackground',
        position: { x: laneArea.left, y: 0 },
        data: { width: laneArea.width, height },
        selectable: false,
        draggable: false,
        zIndex: -1,
      } satisfies Node,
    ];
  }, [diagramHeight, laneArea, sortedLanes.length]);

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
    if (!laneArea) return null;
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
          const top = LANE_PADDING + phase.startRow * ROW_HEIGHT;
          const height = Math.max(ROW_HEIGHT, (phase.endRow - phase.startRow + 1) * ROW_HEIGHT);
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
            className={`pointer-events-auto flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-2 py-4 text-xs font-semibold shadow-sm transition-all duration-150 ease-out ${
              canAddPhase
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
  }, [canAddPhase, handleAddPhase, handlePhaseResizeStart, laneArea, phaseAddButtonY, phaseGroups, phaseLabelX, phaseResize?.id, phaseAddMessage, viewportState.x, viewportState.y, viewportState.zoom, openPhaseEditor, selectedPhaseIds]);

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
        const xStart = deriveLanePositionX(candidate.order);
        const xEnd = xStart + LANE_WIDTH;
        return projected.x >= xStart && projected.x <= xEnd;
      });
      if (lane) {
        selectLaneRow(lane.id, projected.y);
      } else {
        clearSelection();
        clearPendingInsert();
        setSelectedPhaseRow(null);
      }
    },
    [clearPendingInsert, clearSelection, isSpacePanning, projectPointer, selectLaneRow, sortedLanes]
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
        selectLaneRow(laneId, projected.y);
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
        minHeight: diagramHeight,
        cursor: isSpacePanning ? 'grab' : 'default',
      }}
    >
      {renderPhaseOverlay()}
      <ReactFlow
        className={`h-full w-full ${isSpacePanning ? 'cursor-grab' : 'cursor-default'}`}
        style={{ minHeight: diagramHeight, zIndex: 1 }}
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
