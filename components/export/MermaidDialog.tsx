import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { exportDiagramToMermaid } from '@/lib/mermaid/export';
import { importMermaidToDiagram } from '@/lib/mermaid/import';
import { downloadFile } from '@/lib/utils/download';
import { useDiagramStore } from '@/state/useDiagramStore';

interface MermaidDialogProps {
  open: boolean;
  onClose: () => void;
  onStatus?: (type: 'info' | 'error', text: string) => void;
}

export const MermaidDialog = ({ open, onClose, onStatus }: MermaidDialogProps) => {
  const diagram = useDiagramStore((state) => state.diagram);
  const setDiagram = useDiagramStore((state) => state.setDiagram);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setImportText('');
      setMessage(null);
      setError(null);
    }
  }, [open]);

  const mermaid = useMemo(() => exportDiagramToMermaid(diagram), [diagram]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(mermaid);
        setMessage('Mermaidテキストをコピーしました');
        onStatus?.('info', 'Mermaidテキストをコピーしました');
      } else {
        throw new Error('クリップボードAPIが利用できません');
      }
    } catch (err) {
      setError((err as Error).message);
      onStatus?.('error', (err as Error).message ?? 'コピーに失敗しました');
    }
  };

  const handleDownload = () => {
    downloadFile(`${diagram.title || 'swimlane'}.md`, mermaid, 'text/markdown');
    setMessage('Mermaidファイルをダウンロードしました');
    onStatus?.('info', 'Mermaidファイルをダウンロードしました');
  };

  const handleImport = () => {
    try {
      const result = importMermaidToDiagram(importText);
      setDiagram(result, { label: 'mermaid import', preserveLayout: true });
      setError(null);
      onStatus?.('info', 'Mermaidファイルをインポートしました');
      onClose();
    } catch (err) {
      setError((err as Error).message ?? 'インポートに失敗しました');
      onStatus?.('error', (err as Error).message ?? 'Mermaidのインポートに失敗しました');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Mermaidエクスポート / インポート">
      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold text-slate-700">エクスポート</h3>
          <p className="text-xs text-slate-500">
            下記のMermaid記法をコピーするか、`.md`ファイルとしてダウンロードできます。
          </p>
        </header>
        <textarea
          className="h-48 w-full rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs font-mono"
          value={mermaid}
          readOnly
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleCopy}>
            クリップボードにコピー
          </Button>
          <Button type="button" variant="outline" onClick={handleDownload}>
            `.md`ファイルとして保存
          </Button>
        </div>
      </section>

      <hr className="my-6 border-border" />

      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold text-slate-700">インポート</h3>
          <p className="text-xs text-slate-500">
            Swimlane Studio形式のMermaidテキストを貼り付けて、図を復元します。
          </p>
        </header>
        <textarea
          className="h-40 w-full rounded-lg border border-border bg-white px-3 py-2 text-xs font-mono"
          placeholder={`\`\`\`mermaid
%% Swimlane Studio Export v1
...\`\`\``}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
        />
        <div className="flex gap-2">
          <Button type="button" variant="primary" onClick={handleImport} disabled={!importText.trim()}>
            インポートを実行
          </Button>
          <Button type="button" variant="ghost" onClick={() => setImportText('')}>
            クリア
          </Button>
        </div>
      </section>

      {(message || error) && (
        <p className={`mt-4 text-sm ${error ? 'text-red-600' : 'text-green-600'}`}>
          {error ?? message}
        </p>
      )}
    </Dialog>
  );
};
