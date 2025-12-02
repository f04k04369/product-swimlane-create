import type { CSSProperties } from 'react';
import { useCallback, useRef } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import classNames from 'classnames';
import type { StepKind } from '@/lib/diagram/types';
import { useDiagramStore } from '@/state/useDiagramStore';

interface StepNodeData {
  id: string;
  title: string;
  description?: string;
  color: string;
  fillColor?: string;
  laneColor: string;
  onSelect: (id: string) => void;
  width: number;
  height: number;
  kind: StepKind;
  order: number;
  isConnecting?: boolean;
  orientation: 'vertical' | 'horizontal';
}

export const StepNode = ({ id, data, selected, dragging }: NodeProps<StepNodeData>) => {
  const updateStep = useDiagramStore((state) => state.updateStep);
  const { title, description, color, fillColor, laneColor, width, height, kind, onSelect, order, orientation } = data;
  const isHorizontal = orientation === 'horizontal';

  const containerStyle: CSSProperties = {
    width,
    height,
  };

  const baseContentClass = 'flex h-full w-full flex-col justify-center px-4 py-3 text-center text-sm shadow-lg transition';
  const stateClass = selected ? 'ring-2 ring-primary' : 'hover:shadow-xl';
  const cursorClass = dragging ? 'cursor-grabbing' : 'cursor-grab';
  const contentStyle: CSSProperties = {};

  const contentClass = (() => {
    switch (kind) {
      case 'decision':
        contentStyle.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
        contentStyle.backgroundColor = fillColor || '#e4c9fd';
        contentStyle.border = `1px solid #c4b5fd`;
        return classNames(baseContentClass, stateClass);
      case 'start':
        contentStyle.backgroundColor = fillColor || '#ecfdf5';
        contentStyle.border = '1px solid #a7f3d0';
        contentStyle.borderRadius = 9999;
        return classNames(baseContentClass, stateClass, 'text-emerald-700 font-semibold');
      case 'end':
        contentStyle.backgroundColor = fillColor || '#fef2f2';
        contentStyle.border = '1px solid #fecaca';
        contentStyle.borderRadius = 9999;
        return classNames(baseContentClass, stateClass, 'text-rose-700 font-semibold');
      case 'file':
        contentStyle.backgroundColor = fillColor || '#fff4ad';
        contentStyle.border = '1px solid #facc15';
        contentStyle.borderRadius = 14;
        contentStyle.position = 'relative';
        contentStyle.zIndex = 1;
        return classNames(baseContentClass, stateClass, 'relative overflow-hidden');
      case 'loop':
      case 'loopStart':
        contentStyle.clipPath = isHorizontal
          ? 'polygon(0% 20%, 100% 0%, 100% 100%, 0% 80%)'
          : 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)';
        contentStyle.backgroundColor = fillColor || '#e0ebff';
        contentStyle.border = '1px solid #bae6fd';
        return classNames(baseContentClass, stateClass);
      case 'loopEnd':
        contentStyle.clipPath = isHorizontal
          ? 'polygon(0% 0%, 100% 20%, 100% 80%, 0% 100%)'
          : 'polygon(0% 0%, 100% 0%, 80% 100%, 20% 100%)';
        contentStyle.backgroundColor = fillColor || '#e0ebff';
        contentStyle.border = '1px solid #bae6fd';
        return classNames(baseContentClass, stateClass);
      case 'database':
        // Database shape is complex, handled by SVG in the render
        contentStyle.backgroundColor = 'transparent';
        contentStyle.border = 'none';
        contentStyle.boxShadow = 'none';
        return classNames(baseContentClass, stateClass.replace('shadow-lg', '').replace('hover:shadow-xl', ''));
      default:
        if (isHorizontal) {
          contentStyle.borderTopWidth = 6;
          contentStyle.borderTopColor = laneColor;
          contentStyle.borderTopStyle = 'solid';
        } else {
          contentStyle.borderLeftWidth = 6;
          contentStyle.borderLeftColor = laneColor;
          contentStyle.borderLeftStyle = 'solid';
        }
        contentStyle.backgroundColor = fillColor || '#e0ebff';
        contentStyle.border = '1px solid #bae6fd';
        return classNames(baseContentClass, stateClass, 'rounded-lg');
    }
  })();

  const dragStateRef = useRef<{ startX: number; startY: number; startW: number; startH: number; dir: 'nw' | 'ne' | 'sw' | 'se' } | null>(null);

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, dir: 'nw' | 'ne' | 'sw' | 'se') => {
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      dragStateRef.current = { startX, startY, startW: width, startH: height, dir };

      const handleMove = (move: PointerEvent) => {
        if (!dragStateRef.current) return;
        const dx = move.clientX - dragStateRef.current.startX;
        const dy = move.clientY - dragStateRef.current.startY;
        let nextW = dragStateRef.current.startW;
        let nextH = dragStateRef.current.startH;
        if (dragStateRef.current.dir.includes('e')) nextW = dragStateRef.current.startW + dx;
        if (dragStateRef.current.dir.includes('w')) nextW = dragStateRef.current.startW - dx;
        if (dragStateRef.current.dir.includes('s')) nextH = dragStateRef.current.startH + dy;
        if (dragStateRef.current.dir.includes('n')) nextH = dragStateRef.current.startH - dy;
        nextW = Math.max(120, Math.round(nextW));
        nextH = Math.max(60, Math.round(nextH));
        updateStep(id, { width: nextW, height: nextH });
      };

      const handleUp = () => {
        dragStateRef.current = null;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [height, id, updateStep, width]
  );

  const cornerClass = 'absolute z-10 h-3 w-3 rounded border border-white shadow';
  const cornerStyleCommon: CSSProperties = { backgroundColor: '#f59e0b' }; // コネクタと色を変える（アンバー）

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="step-node"
      style={containerStyle}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(id);
        }
      }}
      className={`react-flow__node-step relative flex h-full w-full focus:outline-none ${cursorClass}`}
    >
      <div className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm">
        {isHorizontal ? '列' : '行'} {order + 1}
      </div>
      <div className="relative h-full w-full">
        {kind === 'database' && (
          <div className="absolute inset-0 z-0">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none">
              <path
                d="M0 15 C0 7 22.5 0 50 0 S100 7 100 15 V85 C100 93 77.5 100 50 100 S0 93 0 85 Z"
                fill={fillColor || '#e0ebff'}
                stroke="#bae6fd"
                strokeWidth="2"
              />
              <ellipse cx="50" cy="15" rx="50" ry="15" fill={fillColor || '#e0ebff'} stroke="#bae6fd" strokeWidth="2" />
            </svg>
          </div>
        )}
        <div className={contentClass} style={contentStyle}>
          {kind === 'file' && (
            <div className="pointer-events-none absolute right-3 top-3 h-6 w-6 text-slate-600" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
          )}
          <span className="font-semibold whitespace-pre-line break-words relative z-10" style={{ color }}>
            {title || '無題のステップ'}
          </span>
          {description && (
            <p className="mt-2 whitespace-pre-line break-words text-xs text-slate-500 relative z-10">
              {description}
            </p>
          )}
        </div>
      </div>
      {kind !== 'end' && (
        <>
          <Handle
            type="source"
            id="bottom"
            position={Position.Bottom}
            className="!h-4 !w-4 !bg-primary !border !border-white !shadow"
            style={{ opacity: 1, pointerEvents: 'all', zIndex: 20 }}
          />
          <Handle
            type="target"
            id="bottom-target"
            position={Position.Bottom}
            className="!h-4 !w-4 !bg-primary !border !border-white !shadow"
            style={{ opacity: 1, pointerEvents: 'all', zIndex: 20 }}
          />
        </>
      )}
      {kind !== 'start' && (
        <>
          <Handle
            type="target"
            id="top"
            position={Position.Top}
            className="!h-4 !w-4 !bg-primary !border !border-white !shadow"
            style={{ opacity: 1, pointerEvents: 'all', zIndex: 20 }}
          />
          <Handle
            type="source"
            id="top-source"
            position={Position.Top}
            className="!h-4 !w-4 !bg-primary !border !border-white !shadow"
            style={{ opacity: 1, pointerEvents: 'all', zIndex: 20 }}
          />
        </>
      )}
      {kind !== 'start' && (
        <Handle
          type="target"
          id={`${id}-left-target`}
          position={Position.Left}
          className="!h-4 !w-4 !bg-primary !border !border-white !shadow"
          style={{ top: '60%', left: -14, transform: 'translateY(-50%)', opacity: 1, pointerEvents: 'all', zIndex: 20 }}
        />
      )}
      {kind !== 'end' && (
        <Handle
          type="source"
          id={`${id}-left-source`}
          position={Position.Left}
          className="!h-4 !w-4 !bg-primary !border !border-white !shadow"
          style={{ top: '60%', left: -14, transform: 'translateY(-50%)', opacity: 1, pointerEvents: 'all', zIndex: 20 }}
        />
      )}
      {kind !== 'start' && (
        <Handle
          type="target"
          id={`${id}-right-target`}
          position={Position.Right}
          className="!h-4 !w-4 !bg-primary !border !border-white !shadow"
          style={{ top: '60%', right: -14, transform: 'translateY(-50%)', opacity: 1, pointerEvents: 'all', zIndex: 20 }}
        />
      )}
      {kind !== 'end' && (
        <Handle
          type="source"
          id={`${id}-right-source`}
          position={Position.Right}
          className="!h-4 !w-4 !bg-primary !border !border-white !shadow"
          style={{ top: '60%', right: -14, transform: 'translateY(-50%)', opacity: 1, pointerEvents: 'all', zIndex: 20 }}
        />
      )}

      {/* リサイズ用四隅ハンドル（選択時のみ表示） */}
      {selected && (
        <>
          <div
            role="presentation"
            className={cornerClass}
            style={{ ...cornerStyleCommon, left: -6, top: -6, cursor: 'nwse-resize' }}
            onPointerDown={(e) => onResizePointerDown(e, 'nw')}
          />
          <div
            role="presentation"
            className={cornerClass}
            style={{ ...cornerStyleCommon, right: -6, top: -6, cursor: 'nesw-resize' }}
            onPointerDown={(e) => onResizePointerDown(e, 'ne')}
          />
          <div
            role="presentation"
            className={cornerClass}
            style={{ ...cornerStyleCommon, left: -6, bottom: -6, cursor: 'nesw-resize' }}
            onPointerDown={(e) => onResizePointerDown(e, 'sw')}
          />
          <div
            role="presentation"
            className={cornerClass}
            style={{ ...cornerStyleCommon, right: -6, bottom: -6, cursor: 'nwse-resize' }}
            onPointerDown={(e) => onResizePointerDown(e, 'se')}
          />
        </>
      )}
    </div>
  );
};
