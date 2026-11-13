import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ArrowDownToLine, FilePlus2, FileText, Trash2, X } from 'lucide-react';
import { Button } from '../components/ui';
import { useToast } from '../components/toast';
import {
  asFilePayload, downloadDocument, resourceApi,
  type DocumentMeta, type ResourceRecord
} from './resource-api';
import './resource-documents.css';

const MAX_DOCUMENTS = 20;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_BATCH_BYTES = 6 * 1024 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const accepted = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx';
const allowedMimeTypes = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

function niceSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    : Math.max(1, Math.ceil(bytes / 1024)) + ' KB';
}

export default function ResourceDocuments({
  resource, canManage, onChanged, context = 'details'
}: {
  resource: ResourceRecord; canManage: boolean;
  onChanged: (updated: ResourceRecord) => void;
  context?: 'details' | 'edit'
}) {
  const toast = useToast();
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DocumentMeta | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!confirmDelete) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.stopPropagation();
        setConfirmDelete(null);
        setError('');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmDelete, busy]);

  const remaining = MAX_DOCUMENTS - resource.documents.length;
  const totalBytes = resource.documents.reduce((sum, file) => sum + file.byteSize, 0);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!chosen.length || busy || !canManage) return;
    setError('');
    if (chosen.length > 4 || chosen.length > remaining) {
      setError('Select up to 4 files at once (maximum 20 stored documents per resource).');
      return;
    }
    if (chosen.some(file => file.size > MAX_FILE_BYTES || file.size === 0) ||
      chosen.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH_BYTES ||
      totalBytes + chosen.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
      setError('Limit: 2 MB per file, 6 MB per upload and 20 MB total per resource.');
      return;
    }
    if (chosen.some(file => file.type && !allowedMimeTypes.has(file.type))) {
      setError('Supported files: PDF, JPEG, PNG, WebP, TXT, CSV, DOCX and XLSX.');
      return;
    }
    setBusy(true);
    try {
      const documents = await Promise.all(chosen.map(asFilePayload));
      const updated = await resourceApi.uploadDocuments(resource.id, documents);
      onChanged(updated.resource);
      toast.success(chosen.length === 1 ? 'Document uploaded.' : chosen.length + ' documents uploaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload documents.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete || busy) return;
    setBusy(true); setError('');
    try {
      const updated = await resourceApi.deleteDocument(resource.id, confirmDelete.id);
      onChanged(updated.resource);
      setConfirmDelete(null);
      toast.success('Document deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete document.');
    } finally {
      setBusy(false);
    }
  }

  async function download(file: DocumentMeta) {
    try { await downloadDocument(resource.id, file); }
    catch (err) { setError(err instanceof Error ? err.message : 'Document download failed.'); }
  }

  return <div className="rd-documents">
    {canManage && <div className="rd-documents-toolbar">
      <div className="rd-documents-intro">
        <strong>Attachments</strong>
        <span>{resource.documents.length} / {MAX_DOCUMENTS} files · {niceSize(totalBytes)} / 20 MB</span>
      </div>
      <input ref={picker} className="rd-document-file" type="file" multiple
        accept={accepted} aria-label="Select resource documents"
        onChange={event => { void upload(event); }}/>
      <Button icon={<FilePlus2 size={16}/>} disabled={busy || remaining <= 0}
        onClick={() => picker.current?.click()}>
        {busy ? 'Saving...' : 'Add documents'}
      </Button>
    </div>}

    {context === 'edit' && <p className="rd-edit-note">
      Documents are saved immediately when uploaded or deleted. Other resource changes are saved
      separately when you choose Save changes.
    </p>}

    {resource.documents.length ? <div className="rd-documents-list">
      {resource.documents.map(file => <div className="rd-document-row" key={file.id}>
        <span className="rd-document-symbol"><FileText size={19}/></span>
        <div className="rd-document-title">
          <strong>{file.filename}</strong>
          <small>{niceSize(file.byteSize)} · {new Date(file.createdAt).toLocaleDateString()}</small>
        </div>
        <div className="rd-document-actions">
          <Button disabled={busy} icon={<ArrowDownToLine size={15}/>}
            onClick={() => { void download(file); }}>Download</Button>
          {canManage && <Button disabled={busy} icon={<Trash2 size={15}/>}
            aria-label={'Delete ' + file.filename} onClick={() => setConfirmDelete(file)}>
            Delete
          </Button>}
        </div>
      </div>)}
    </div> : <div className="rd-documents-empty">
      <FilePlus2 size={23}/>
      <strong>No documents attached</strong>
      <p>{canManage ? 'Add an invoice, warranty, photo or another supporting file.' :
        'No documents are stored for this resource.'}</p>
    </div>}
    {canManage && <p className="rd-documents-limits">
      PDF, JPG, PNG, WebP, TXT, CSV, DOCX or XLSX. Up to 4 per upload, 2 MB each, 20 documents / 20 MB total.
    </p>}
    {error && <p className="rd-documents-error" role="alert">{error}</p>}

    {confirmDelete && <div className="rd-document-confirm-shade"
      onMouseDown={event => { if (event.target === event.currentTarget && !busy) setConfirmDelete(null); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="rd-confirm-title"
        className="rd-document-confirm">
        <h3 id="rd-confirm-title">Delete document?</h3>
        <p>Delete <strong>{confirmDelete.filename}</strong> from {resource.assetCode}?
          This permanently removes the file; the audit history is preserved.</p>
        {error && <p className="rd-documents-error" role="alert">{error}</p>}
        <div className="rd-confirm-actions">
          <Button disabled={busy} icon={<X size={14}/>} onClick={() => { setConfirmDelete(null); setError(''); }}>
            Cancel
          </Button>
          <Button disabled={busy} variant="primary" icon={<Trash2 size={14}/>}
            onClick={() => { void remove(); }}>
            {busy ? 'Deleting...' : 'Delete document'}
          </Button>
        </div>
      </div>
    </div>}
  </div>;
}
