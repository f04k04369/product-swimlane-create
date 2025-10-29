import type { PointerEvent as ReactPointerEvent } from 'react';
import classNames from 'classnames';

interface PhaseLabelProps {
  id: string;
  title: string;
  width: number;
  height: number;
  isActive: boolean;
  onEdit: () => void;
  onResizeStart: (id: string, direction: 'start' | 'end', event: ReactPointerEvent<HTMLButtonElement>) => void;
}

export const PhaseLabel = ({ id, title, width, height, onEdit, isActive, onResizeStart }: PhaseLabelProps) => {
  return (
    <div
      className="pointer-events-auto relative flex justify-center px-1 transition-all duration-150 ease-out"
      style={{ width, height }}
    >
      <button
        type="button"
        className={classNames(
          'pointer-events-auto flex h-full w-full items-center justify-center rounded-xl border px-2 py-3 text-xs font-semibold transition-all duration-150 ease-out',
          isActive
            ? 'border-blue-500 bg-blue-100/80 text-blue-700 shadow'
            : 'border-slate-300 bg-slate-200/60 text-slate-600 hover:border-slate-400 hover:bg-slate-300/80'
        )}
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
      >
        <span className="tracking-widest" style={{ writingMode: 'vertical-rl' }}>
          {title || 'フェーズ設定'}
        </span>
      </button>
      <button
        type="button"
        className="pointer-events-auto absolute left-1/2 top-0 h-3 w-10 -translate-x-1/2 -translate-y-1 cursor-ns-resize rounded-full border border-slate-400 bg-white/90 shadow transition-colors duration-150 hover:border-blue-400 hover:bg-blue-100"
        onPointerDown={(event) => {
          event.stopPropagation();
          onResizeStart(id, 'start', event);
        }}
      />
      <button
        type="button"
        className="pointer-events-auto absolute bottom-0 left-1/2 h-3 w-10 -translate-x-1/2 translate-y-1 cursor-ns-resize rounded-full border border-slate-400 bg-white/90 shadow transition-colors duration-150 hover:border-blue-400 hover:bg-blue-100"
        onPointerDown={(event) => {
          event.stopPropagation();
          onResizeStart(id, 'end', event);
        }}
      />
    </div>
  );
};
