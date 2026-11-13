export type ItemStatus =
  'PENDING' | 'ACCEPTED' | 'ISSUE_REPORTED' | 'RETURN_REQUESTED' |
  'RETURNED' | 'TRANSFER_PENDING' | 'TRANSFERRED' | 'CANCELLED';
export type AssignmentStatus =
  'Pending confirmation' | 'Partially accepted' | 'Active' | 'Issue reported' |
  'Return requested' | 'Transfer pending' | 'Completed' | 'Cancelled';
export type AssignmentAsset = {
  itemId: string; resourceId: string; id: string; name: string; condition: string;
  receipt: ItemStatus; sourceItemId: string | null;
  receiptNotes: string; acceptedAt: string | null; returnedAt: string | null;
  returnCondition: string | null;
  evidence: { filename: string; mimeType: string; byteSize: number } | null;
};
export type Assignment = {
  id: string; code: string; kind: 'BRANCH_ISSUE' | 'EMPLOYEE_TRANSFER';
  branchId: string; branch: string; recipientId: string; employee: string;
  issuedBy: string; issued: string; returnDue: string | null;
  status: AssignmentStatus; notes: string; assets: AssignmentAsset[];
  activity: { id: string; title: string; detail: string; details: unknown }[];
};
export type Recipient = { id: string; fullName: string; branchId: string };
export type AvailableAsset = { id: string; assetCode: string; name: string; condition: string; branchId: string };
export type Lookups = {
  recipients: Recipient[]; availableAssets: AvailableAsset[];
  branches: { id: string; name: string }[]; canManage: boolean;
};
export type Summary = { active: number; pending: number; returns: number; completed: number };
export type Receipt = {
  itemId: string; decision: 'ACCEPT' | 'REPORT_ISSUE'; notes: string;
  evidence?: { filename: string; mimeType: string; base64: string };
};
async function request<T>(path: string, body?: object): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!csrf.ok) throw Error('Unable to initialize secure request');
    const payload = await csrf.json() as { csrfToken: string };
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = payload.csrfToken;
  }
  const response = await fetch('/api/v1/assignments' + path, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    cache: 'no-store', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw Error(data.error?.message || 'Assignment operation failed');
  }
  return response.json() as Promise<T>;
}
export const assignmentsApi = {
  list: () => request<{ assignments: Assignment[]; summary: Summary; truncated: boolean }>('/'),
  lookups: () => request<Lookups>('/lookups'),
  issue: (data: { recipientId: string; resourceIds: string[]; dueAt: string | null; notes: string }) =>
    request<{ id: string; code: string }>('/', data),
  receipt: (id: string, decisions: Receipt[]) =>
    request<{ ok: boolean }>('/' + encodeURIComponent(id) + '/receipt', { decisions }),
  requestReturn: (id: string, itemIds: string[]) =>
    request<{ ok: boolean }>('/' + encodeURIComponent(id) + '/returns/request', { itemIds }),
  verifyReturn: (id: string, items: { itemId: string; condition: string }[]) =>
    request<{ ok: boolean }>('/' + encodeURIComponent(id) + '/returns/verify', { items }),
  transfer: (id: string, data: { recipientId: string; itemIds: string[]; dueAt: string | null; notes: string }) =>
    request<{ id: string; code: string }>('/' + encodeURIComponent(id) + '/transfers', data),
  cancelTransfer: (id: string) =>
    request<{ ok: boolean }>('/' + encodeURIComponent(id) + '/transfers/cancel', {})
};
