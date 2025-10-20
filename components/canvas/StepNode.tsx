import type { CSSProperties } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import classNames from 'classnames';
import type { StepKind } from '@/lib/diagram/types';

interface StepNodeData {
  id: string;
  title: string;
  description?: string;
  color: string;
  laneColor: string;
  onSelect: (id: string) => void;
  width: number;
  height: number;
  kind: StepKind;
  order: number;
}

export const StepNode = ({ id, data, selected }: NodeProps<StepNodeData>) => {
  const { title, description, color, laneColor, width, height, kind, onSelect, order } = data;

  const containerStyle: CSSProperties = {
    width,
    height,
  };

  const baseContentClass = 'flex h-full w-full flex-col justify-center px-4 py-3 text-center text-sm shadow-lg transition';
  const stateClass = selected ? 'ring-2 ring-primary' : 'hover:shadow-xl';
  const contentStyle: CSSProperties = {};

  const contentClass = (() => {
    switch (kind) {
      case 'decision':
        contentStyle.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
        contentStyle.backgroundColor = '#ede9fe';
        contentStyle.border = `2px solid #c4b5fd`;
        contentStyle.filter = 'drop-shadow(0 8px 14px rgba(99, 102, 241, 0.25))';
        return classNames(baseContentClass, stateClass, 'text-violet-900');
      case 'start':
        return classNames(
          baseContentClass,
          stateClass,
          'rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold'
        );
      case 'end':
        return classNames(
          baseContentClass,
          stateClass,
          'rounded-full border border-rose-200 bg-rose-50 text-rose-700 font-semibold'
        );
      case 'file':
        contentStyle.backgroundColor = '#fef9c3';
        contentStyle.border = '1px solid #facc15';
        contentStyle.borderTopLeftRadius = 12;
        contentStyle.borderTopRightRadius = 12;
        contentStyle.borderBottomLeftRadius = 12;
        contentStyle.borderBottomRightRadius = 12;
        contentStyle.position = 'relative';
        return classNames(baseContentClass, stateClass, 'relative overflow-hidden text-amber-900');
      default:
        contentStyle.borderLeftWidth = 6;
        contentStyle.borderLeftColor = laneColor;
        contentStyle.borderLeftStyle = 'solid';
        contentStyle.backgroundColor = '#e0f2fe';
        contentStyle.border = '1px solid #bae6fd';
        return classNames(baseContentClass, stateClass, 'rounded-lg text-slate-900');
    }
  })();

  const showFold = kind === 'file';

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
      className="relative flex h-full w-full focus:outline-none"
    >
      <div className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm">
        行 {order + 1}
      </div>
      <div className="relative h-full w-full">
        <div className={contentClass} style={contentStyle}>
          <span className="font-semibold" style={{ color }}>
            {title || '無題のステップ'}
          </span>
          {description && <p className="mt-2 text-xs text-slate-500">{description}</p>}
        </div>
        {showFold && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0 0 H100 V68 C75 94 25 94 0 68 Z"
              fill="#fef3bf"
            />
            <path
              d="M0 0 H100 V68 C75 94 25 94 0 68 Z"
              stroke="#facc15"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        )}
      </div>
      {kind !== 'end' && (
        <Handle
          type="source"
          id="bottom"
          position={Position.Bottom}
          className="!h-3 !w-3 !bg-primary !border !border-white !shadow"
        />
      )}
      {kind !== 'start' && (
        <Handle
          type="target"
          id="top"
          position={Position.Top}
          className="!h-3 !w-3 !bg-primary !border !border-white !shadow"
        />
      )}
      {kind !== 'start' && (
        <Handle
          type="target"
          id={`${id}-left-target`}
          position={Position.Left}
          className="!h-3 !w-3 !bg-primary !border !border-white !shadow"
          style={{ top: '60%', left: -12, transform: 'translateY(-50%)', opacity: 0, pointerEvents: 'all' }}
        />
      )}
      {kind !== 'end' && (
        <Handle
          type="source"
          id={`${id}-left-source`}
          position={Position.Left}
          className="!h-3 !w-3 !bg-primary !border !border-white !shadow"
          style={{ top: '60%', left: -12, transform: 'translateY(-50%)' }}
        />
      )}
      {kind !== 'start' && (
        <Handle
          type="target"
          id={`${id}-right-target`}
          position={Position.Right}
          className="!h-3 !w-3 !bg-primary !border !border-white !shadow"
          style={{ top: '60%', right: -12, transform: 'translateY(-50%)', opacity: 0, pointerEvents: 'all' }}
        />
      )}
      {kind !== 'end' && (
        <Handle
          type="source"
          id={`${id}-right-source`}
          position={Position.Right}
          className="!h-3 !w-3 !bg-primary !border !border-white !shadow"
          style={{ top: '60%', right: -12, transform: 'translateY(-50%)' }}
        />
      )}
    </div>
  );
};
