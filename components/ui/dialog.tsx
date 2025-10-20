import { Fragment, ReactNode } from 'react';
import classNames from 'classnames';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}

export const Dialog = ({ open, title, onClose, children, widthClassName }: DialogProps) => {
  if (!open) return null;

  return (
    <Fragment>
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
        <div
          className={classNames(
            'relative max-h-full overflow-hidden rounded-2xl border border-border bg-white shadow-2xl',
            widthClassName ?? 'w-full max-w-2xl'
          )}
        >
          <header className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <button
              type="button"
              aria-label="閉じる"
              className="h-8 w-8 rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              onClick={onClose}
            >
              ×
            </button>
          </header>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        </div>
      </div>
    </Fragment>
  );
};
