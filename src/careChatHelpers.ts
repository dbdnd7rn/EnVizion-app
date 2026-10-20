/** Immutable, order-stable reconciliation of history, optimistic inserts and Realtime echoes. */
export function mergeChatMessages<T extends { id: string; created_at: string }>(older: T[], latest: T[]): T[] {
  const rows = new Map<string,T>();
  for (const row of older) rows.set(row.id,row);
  for (const row of latest) rows.set(row.id,row);
  return Array.from(rows.values()).sort((a,b) =>
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).slice(-300);
}

/** Normalize user-provided message search without letting wildcard metacharacters broaden queries. */
export function chatSearchTerm(query: string) {
  return query.trim().slice(0,100).replace(/[%,_]/g," ");
}
