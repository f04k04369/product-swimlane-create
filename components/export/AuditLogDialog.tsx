import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { auditLogToJson } from '@/lib/audit/export';
import { downloadFile } from '@/lib/utils/download';
import { useDiagramStore } from '@/state/useDiagramStore';

interface AuditLogDialogProps {
  open: boolean;
  onClose: () => void;
  onStatus?: (type: 'info' | 'error', text: string) => void;
}

export const AuditLogDialog = ({ open, onClose, onStatus }: AuditLogDialogProps) => {
  const auditTrail = useDiagramStore((state) => state.auditTrail);

  const handleDownload = () => {
    const payload = auditLogToJson(auditTrail);
    downloadFile('swimlane-audit-log.json', payload, 'application/json');
    onStatus?.('info', '監査ログをダウンロードしました');
  };

  return (
    <Dialog open={open} onClose={onClose} title="監査ログ">
      <section className="space-y-4">
        <p className="text-sm text-slate-500">
          セッション中の操作履歴です。JSON形式でダウンロードし、変更履歴の証跡として保管できます。
        </p>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-slate-50">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-200/70 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">時刻</th>
                <th className="px-3 py-2 font-medium">アクション</th>
                <th className="px-3 py-2 font-medium">対象</th>
              </tr>
            </thead>
            <tbody>
              {auditTrail.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                    操作履歴はまだありません。
                  </td>
                </tr>
              )}
              {auditTrail.map((entry) => (
                <tr key={entry.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{entry.action}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {entry.targetType}
                    {entry.targetId ? `: ${entry.targetId}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={handleDownload} disabled={!auditTrail.length}>
            JSONとしてダウンロード
          </Button>
        </div>
      </section>
    </Dialog>
  );
};
