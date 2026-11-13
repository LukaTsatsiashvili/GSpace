export type ApprovalField = {
  key: string; label: string; type: 'text' | 'number' | 'date' | 'select' | 'multi_select';
  required: boolean; options?: string[];
};
export type ApproverTarget = { kind: 'USER' | 'ROLE'; id: string };
export type ApprovalStep = { mode: 'ANY' | 'ALL'; targets: ApproverTarget[] };
export type ApprovalTypeRecord = {
  id: string; code: string; name: string; description: string; active: boolean; version: number;
  fields: ApprovalField[]; steps: ApprovalStep[]; deadlineDays: number;
};
export type ApprovalRequestRecord = {
  id: string; code: string; title: string; reason: string; amount: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'CANCELLED';
  currentStep: number; totalSteps: number; steps: ApprovalStep[];
  values: Record<string, string | string[]>; fields: ApprovalField[];
  typeId: string; type: string; typeCode: string; version: number;
  requesterId: string; requester: string; branchId: string; branch: string;
  dueAt: string | null; createdAt: string; completedAt: string | null;
  canCancel: boolean; canResubmit: boolean; canReview: boolean;
  reviews: { id: string; step: number; reviewerId: string; reviewer: string;
    status: string; comment: string; decidedAt: string | null }[];
  events: { id: string; action: string; actor: string; comment: string; at: string;
    details: unknown }[];
};
export type ApprovalLookups = {
  branches: { id: string; name: string }[];
  users: { id: string; fullName: string }[];
  roles: { id: string; name: string }[];
  canConfigure: boolean; canExport: boolean;
};
export type ApprovalTypeInput = Omit<ApprovalTypeRecord, 'id' | 'version'>;
export type ApprovalSubmission = {
  typeId: string; branchId: string; title: string; reason: string;
  amount: number | null; values: Record<string, string | string[]>;
};
async function responseError(response: Response): Promise<never> {
  const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
  throw Error(body.error?.message || 'Request failed. Please try again.');
}
async function call<T>(path: string, method = 'GET', payload?: object): Promise<T> {
  let csrfToken = '';
  if (method !== 'GET') {
    const tokenResponse = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!tokenResponse.ok) return responseError(tokenResponse);
    csrfToken = ((await tokenResponse.json()) as { csrfToken: string }).csrfToken;
  }
  const response = await fetch('/api/v1/approvals' + path, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
  });
  if (!response.ok) return responseError(response);
  return response.json() as Promise<T>;
}
export const approvalsApi = {
  lookups: () => call<ApprovalLookups>('/lookups'),
  types: () => call<{ types: ApprovalTypeRecord[] }>('/types'),
  list: () => call<{ requests: ApprovalRequestRecord[]; total: number; limited: boolean }>('/'),
  details: (id: string) => call<{ request: ApprovalRequestRecord }>('/' + encodeURIComponent(id)),
  createType: (data: ApprovalTypeInput) => call<{ id: string }>('/types', 'POST', data),
  updateType: (id: string, data: ApprovalTypeInput) =>
    call<{ ok: true }>('/types/' + encodeURIComponent(id), 'PUT', data),
  createRequest: (data: ApprovalSubmission) => call<{ code: string }>('/', 'POST', data),
  decision: (id: string, decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED', comment: string) =>
    call<{ ok: true }>('/' + encodeURIComponent(id) + '/decision', 'POST', { decision, comment }),
  cancel: (id: string) => call<{ ok: true }>('/' + encodeURIComponent(id) + '/cancel', 'POST', {}),
  resubmit: (id: string, reason: string, values: Record<string, string | string[]>) =>
    call<{ ok: true }>('/' + encodeURIComponent(id) + '/resubmit', 'POST', { reason, values })
};
export async function exportApprovalCsv(requestIds: string[]) {
  const tokenResponse = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!tokenResponse.ok) return responseError(tokenResponse);
  const { csrfToken } = await tokenResponse.json() as { csrfToken: string };
  const response = await fetch('/api/v1/approvals/export/csv', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ requestIds })
  });
  if (!response.ok) return responseError(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'approval-requests.csv';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
