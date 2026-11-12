export type ResourceStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_TRANSFER' | 'IN_MAINTENANCE' | 'RETIRED';
export type ResourceCondition = 'Excellent' | 'Good' | 'Fair' | 'Damaged' | 'Poor';
export type ResourceType = 'Physical Asset' | 'Digital Asset' | 'Bundle';
export type CustomDefinition = { key: string; label: string; required: boolean };
export type Category = { id: string; name: string; definitions: CustomDefinition[] };
export type Branch = { id: string; name: string };
export type DocumentMeta = { id: string; filename: string; mimeType: string; byteSize: number; createdAt: string };
export type ResourceRecord = {
  id: string; assetCode: string; name: string; category: string; resourceType: ResourceType;
  condition: ResourceCondition; status: ResourceStatus; branchId: string; branch: string;
  location: string; serialNumber: string | null; description: string;
  warrantyEnd: string | null; customFields: Record<string, string>;
  documents: DocumentMeta[]; createdAt: string; updatedAt: string;
  purchasePrice?: string | null; currency?: string; purchaseDate?: string | null;
  supplier?: string; usefulLifeMonths?: number | null; residualValue?: string | null;
};
export type ResourcePayload = {
  name: string; category: string; resourceType: ResourceType; condition: ResourceCondition;
  status: 'AVAILABLE' | 'RETIRED'; branchId: string; location: string; serialNumber: string | null;
  description: string; warrantyEnd: string | null;
  purchasePrice: number | null; currency: 'GEL' | 'USD' | 'EUR';
  purchaseDate: string | null; supplier: string;
  usefulLifeMonths: number | null; residualValue: number | null;
  customFields: Record<string, string>;
};
export type FilePayload = { filename: string; mimeType: string; base64: string };
export type ResourceSummary = {
  total: number; assigned: number; available: number; maintenance: number; branches: number
};
export type AuditEntry = {
  id: string; resourceId: string; assetCode: string; action: string; actorId: string;
  actorName: string; before: unknown; after: unknown; createdAt: string
};

async function request<T>(path: string, options?: { method: 'POST' | 'PATCH' | 'DELETE'; body?: object }): Promise<T> {
  let init: RequestInit = { credentials: 'same-origin', cache: 'no-store' };
  if (options) {
    const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!csrf.ok) throw Error('Unable to initialize secure request.');
    const { csrfToken } = await csrf.json() as { csrfToken: string };
    init = { ...init, method: options.method,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      ...(options.body ? { body: JSON.stringify(options.body) } : options.method === 'DELETE' ? { body: '{}' } : {}) };
  }
  const response = await fetch('/api/v1/resources' + path, init);
  if (!response.ok) {
    const details = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw Error(details.error?.message || 'Resource operation failed.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export const resourceApi = {
  list: () => request<{ resources: ResourceRecord[]; summary: ResourceSummary; truncated: boolean }>('/'),
  catalog: () => request<{ branches: Branch[]; categories: Category[] }>('/catalog'),
  one: (id: string) => request<{ resource: ResourceRecord }>('/' + encodeURIComponent(id)),
  create: (body: ResourcePayload & { documents: FilePayload[] }) =>
    request<{ id: string; assetCode: string }>('/', { method: 'POST', body }),
  update: (id: string, body: ResourcePayload) =>
    request<{ ok: boolean }>('/' + encodeURIComponent(id), { method: 'PATCH', body }),
  bulk: (body: { quantity: number; template: Omit<ResourcePayload, 'serialNumber'> }) =>
    request<{ count: number; firstCode: string; lastCode: string }>('/bulk', { method: 'POST', body }),
  importCsv: (resources: ResourcePayload[]) =>
    request<{ count: number; firstCode: string; lastCode: string }>('/bulk/import', { method: 'POST', body: { resources } }),
  audit: (id: string) => request<{ events: AuditEntry[] }>('/' + encodeURIComponent(id) + '/audit'),
  remove: (id: string) => request<void>('/' + encodeURIComponent(id), { method: 'DELETE' }),
  categoryCreate: (body: { name: string; definitions: CustomDefinition[] }) =>
    request<{ id: string }>('/categories', { method: 'POST', body }),
  categoryUpdate: (id: string, body: { name: string; definitions: CustomDefinition[]; active: boolean }) =>
    request<{ ok: boolean }>('/categories/' + encodeURIComponent(id), { method: 'PATCH', body })
};
export async function downloadDocument(resourceId: string, file: DocumentMeta): Promise<void> {
  const response = await fetch('/api/v1/resources/' + encodeURIComponent(resourceId) +
    '/documents/' + encodeURIComponent(file.id), { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw Error('Could not download the document.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = file.filename;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function asFilePayload(file: File): Promise<FilePayload> {
  if (file.size > 2 * 1024 * 1024) throw Error(file.name + ' exceeds the 2 MB per-file limit.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error('Could not read ' + file.name));
    reader.onload = () => {
      const text = String(reader.result);
      const base64 = text.split(',')[1];
      if (!base64) { reject(Error('Invalid attachment ' + file.name)); return; }
      resolve({ filename: file.name, mimeType: file.type, base64 });
    };
    reader.readAsDataURL(file);
  });
}
