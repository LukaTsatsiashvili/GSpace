import { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '../components/ui';

/** Shared, compact confirmation for Administration operations. */
export default function AdministrationFeedback({
  message, onDismiss
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  return (
    <div className="am-feedback" role="status" aria-live="polite" aria-atomic="true">
      <span className="am-feedback-mark" aria-hidden="true">
        <CheckCircle2 size={19}/>
      </span>
      <div className="am-feedback-copy">
        <strong>{message}</strong>
        <span>Changes are now reflected in the system.</span>
      </div>
      <Button
        type="button"
        variant="quiet"
        className="am-feedback-dismiss"
        aria-label="Dismiss notification"
        title="Dismiss"
        icon={<X size={16}/>}
        onClick={onDismiss}
      />
    </div>
  );
}
