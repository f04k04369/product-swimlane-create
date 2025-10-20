import { useCallback, useMemo, type MouseEvent, type TouchEvent, type RefObject } from 'react';
import ReactFlow, { Background, Connection, Controls, Edge, MiniMap, Node } from 'reactflow';
import 'reactflow/dist/style.css';

import { LaneNode } from '@/components/canvas/LaneNode';
import { StepNode } from '@/components/canvas/StepNode';
import { KeyEdge, type KeyEdgeData } from '@/components/canvas/KeyEdge';
import { computeLaneHeight, deriveLanePositionX, LANE_PADDING, LANE_WIDTH, ROW_HEIGHT } from '@/lib/diagram/layout';
import { useDiagramStore } from '@/state/useDiagramStore';
const nodeTypes = {
  lane: LaneNode,
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
  const moveStep = useDiagramStore((state) => state.moveStep);
  const addConnection = useDiagramStore((state) => state.addConnection);
  const removeConnection = useDiagramStore((state) => state.removeConnection);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const clearSelection = useDiagramStore((state) => state.clearSelection);
  const updateConnectionEndpoints = useDiagramStore((state) => state.updateConnectionEndpoints);

  const laneMap = useMemo(() => {
    const map = new Map<string, { title: string; color: string; order: number }>();
    diagram.lanes.forEach((lane) => {
      map.set(lane.id, { title: lane.title, color: lane.color, order: lane.order });
    });
    return map;
  }, [diagram.lanes]);

  const laneHeights = useMemo(() => {
    const map = new Map<string, number>();
    diagram.lanes.forEach((lane) => {
      const laneSteps = diagram.steps.filter((step) => step.laneId === lane.id);
      map.set(lane.id, computeLaneHeight(laneSteps));
    });
    return map;
  }, [diagram.lanes, diagram.steps]);

  const minimumHeight = LANE_PADDING * 2 + ROW_HEIGHT;

  const laneNodes: Node[] = useMemo(
    () =>
      diagram.lanes.map((lane) => ({
        id: `lane-${lane.id}`,
        type: 'lane',
        position: { x: deriveLanePositionX(lane.order), y: 0 },
        data: {
          title: lane.title,
          color: lane.color,
          height: laneHeights.get(lane.id) ?? minimumHeight,
          width: LANE_WIDTH,
        },
        selectable: false,
        draggable: false,
        zIndex: 0,
      })),
    [diagram.lanes, laneHeights, minimumHeight]
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

  const nodes = useMemo(() => [...laneNodes, ...stepNodes], [laneNodes, stepNodes]);

  const canvasHeight = useMemo(() => {
    if (!diagram.lanes.length) return minimumHeight;
    return Math.max(...diagram.lanes.map((lane) => laneHeights.get(lane.id) ?? minimumHeight));
  }, [diagram.lanes, laneHeights, minimumHeight]);

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
      setSelection({ lanes: moved ? [moved.laneId] : [], steps: [node.id], connections: [] });
    },
    [moveStep, setSelection]
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
        setSelection({ lanes: [], steps: [], connections: [created.id] });
      }
    },
    [addConnection, setSelection]
  );

  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge<KeyEdgeData>[]) => {
      deletedEdges.forEach((edge) => {
        removeConnection(edge.id);
      });
      clearSelection();
    },
    [clearSelection, removeConnection]
  );

  const handleEdgeClick = useCallback(
    (event: MouseEvent, edge: Edge<KeyEdgeData>) => {
      event.stopPropagation();
      setSelection({ lanes: [], steps: [], connections: [edge.id] });
    },
    [setSelection]
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
      setSelection({ lanes: [], steps: [], connections: [oldEdge.id] });
    },
    [setSelection, updateConnectionEndpoints]
  );

  const handleEdgeUpdateStart = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge<KeyEdgeData>) => {
      setSelection({ lanes: [], steps: [], connections: [edge.id] });
    },
    [setSelection]
  );

  const handleEdgeUpdateEnd = useCallback(() => {
    // no-op: React Flow handles final connection, state already updated via handleEdgeUpdate
  }, []);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge<KeyEdgeData>[] }) => {
      const manualEdge = selectedEdges.at(0);
      if (manualEdge) {
        setSelection({ lanes: [], steps: [], connections: [manualEdge.id] });
        return;
      }
      const stepNode = selectedNodes.find((node) => node.type === 'step');
      if (stepNode) {
        const laneId = (stepNode.data as { laneId?: string } | undefined)?.laneId;
        setSelection({ lanes: laneId ? [laneId] : [], steps: [stepNode.id], connections: [] });
        return;
      }
      clearSelection();
    },
    [clearSelection, setSelection]
  );

  const handlePaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.type !== 'step') return;
      const laneId = (node.data as { laneId?: string } | undefined)?.laneId;
      setSelection({ lanes: laneId ? [laneId] : [], steps: [node.id], connections: [] });
    },
    [setSelection]
  );

  return (
    <div ref={canvasRef} className="relative flex-1 bg-slate-50" style={{ minHeight: canvasHeight }}>
      <ReactFlow
        className="h-full w-full"
        style={{ minHeight: canvasHeight }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={edgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
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
        edgeUpdaterRadius={16}
      >
        <Background gap={24} size={1} color="#e5e7eb" />
        <Controls position="top-left" showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
};
