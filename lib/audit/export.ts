import type { AuditEntry } from '@/lib/diagram/types';

export const auditLogToJson = (entries: AuditEntry[]) =>
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    },
    null,
    2
  );
