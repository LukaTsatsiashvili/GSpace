import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '../components/ui';
import { resourceApi, type ResourceAssignmentHistory } from './resource-api';

function showDate(raw: string | null | undefined) {
  if (!raw) return '—';
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? '—' :
    date.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function receiptLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Awaiting confirmation',
    ACCEPTED: 'Accepted',
    ISSUE_REPORTED: 'Issue reported',
    RETURN_REQUESTED: 'Return requested',
    RETURNED: 'Returned',
    TRANSFER_PENDING: 'Transfer pending',
    TRANSFERRED: 'Transferred',
    CANCELLED: 'Cancelled'
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

export default function ResourceAssignments({ resourceId }: { resourceId: string }) {
  const [history, setHistory] = useState<ResourceAssignmentHistory | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setHistory(null); setError(''); setLoading(true);
    void resourceApi.assignments(resourceId).then(value => {
      if (active) setHistory(value);
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : 'Could not load assignment history');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [resourceId, reload]);

  if (loading) return <div className="rs-tab-empty"><ClipboardList size={24}/>
    <strong>Loading assignments...</strong></div>;
  if (error) return <div className="rs-tab-empty" role="alert"><ClipboardList size={24}/>
    <strong>Could not load assignments</strong><p>{error}</p>
    <Button onClick={() => setReload(value => value + 1)}>Retry</Button></div>;
  if (!history) return null;

  return <div className="rs-assignment-panel">
    <section className="rs-detail-section">
      <h4>Current assignment</h4>
      {history.current ? <div className="rs-assignment-current">
        <strong>{history.current.userName}</strong>
        <span>{receiptLabel(history.current.itemStatus)} · {history.current.assignmentCode}</span>
        {history.current.pendingRecipientName &&
          <span>Transfer awaiting confirmation from {history.current.pendingRecipientName}</span>}
        <dl className="rs-detail-fields">
          <div><dt>Issued</dt><dd>{showDate(history.current.issuedAt)}</dd></div>
          <div><dt>Return due</dt><dd>{showDate(history.current.returnDue)}</dd></div>
        </dl>
      </div> : <p className="rs-muted">No active handover. Historical assignments are shown below.</p>}
    </section>

    <section className="rs-detail-section">
      <h4>Assignment history ({history.total})</h4>
      {!history.assignments.length ? <div className="rs-tab-empty">
        <ClipboardList size={25}/><strong>No assignments recorded</strong>
        <p>This resource has not yet been issued to an employee.</p>
      </div> : <div className="rs-assignment-history">
        {history.assignments.map(item => <article className="rs-assignment-entry" key={item.itemId}>
          <div className="rs-assignment-entry-head">
            <div><strong>{item.assignmentCode}</strong>
              <span>{item.kind === 'EMPLOYEE_TRANSFER' ? 'Employee-to-employee transfer' : 'Issue from branch'}</span></div>
            <span className={'rs-assignment-status rs-assignment-' + item.status.toLowerCase()}>
              {receiptLabel(item.status)}</span>
          </div>
          <dl className="rs-detail-fields">
            <div><dt>Assigned to</dt><dd>{item.recipientName}</dd></div>
            <div><dt>Issued by</dt><dd>{item.issuedByName}</dd></div>
            <div><dt>Issued at</dt><dd>{showDate(item.issuedAt)}</dd></div>
            <div><dt>Return due</dt><dd>{showDate(item.returnDue)}</dd></div>
            <div><dt>Condition on issue</dt><dd>{item.conditionOnIssue}</dd></div>
            <div><dt>Condition on return</dt><dd>{item.returnCondition ?? '—'}</dd></div>
            {item.acceptedAt && <div><dt>Accepted at</dt><dd>{showDate(item.acceptedAt)}</dd></div>}
            {item.returnRequestedAt && <div><dt>Return requested</dt><dd>{showDate(item.returnRequestedAt)}</dd></div>}
            {item.returnedAt && <div><dt>Returned at</dt><dd>{showDate(item.returnedAt)}</dd></div>}
          </dl>
          {item.notes && <p className="rs-assignment-note"><strong>Handover notes:</strong> {item.notes}</p>}
          {item.receiptNotes && <p className="rs-assignment-note"><strong>Receipt notes:</strong> {item.receiptNotes}</p>}
          {item.evidence && <p className="rs-assignment-evidence">
            Photo attached: {item.evidence.filename} (viewable from Assignments)</p>}
          {item.events.length > 0 && <ol className="rs-assignment-events">
            {item.events.map(event => <li key={event.id}>
              <strong>{event.action.replace(/_/g, ' ')}</strong>
              <span>{event.actorName} · {showDate(event.createdAt)}</span>
            </li>)}
          </ol>}
        </article>)}
      </div>}
      {history.truncated && <p className="rs-muted">Showing the latest 100 assignment entries.</p>}
    </section>
  </div>;
}
