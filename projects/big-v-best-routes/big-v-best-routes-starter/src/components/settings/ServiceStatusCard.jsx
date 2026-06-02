/**
 * ServiceStatusCard.jsx — Collapsible service status block
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, FlaskConical, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import ProviderStatusBadge from './ProviderStatusBadge.jsx';

export default function ServiceStatusCard({
  title, icon: Icon, status, lastTestedAt,
  testResult, onTest, testing,
  fallbackActive, fallbackProvider,
  children,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`serviceCard ${status === 'failed' ? 'cardFailed' : status === 'success' ? 'cardSuccess' : ''}`}>
      <button
        className="serviceCardHeader"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        type="button"
      >
        <span className="serviceCardTitle">
          {Icon && <Icon size={16} style={{ flexShrink: 0 }} />}
          {title}
        </span>
        <span className="serviceCardHeaderRight">
          <ProviderStatusBadge status={testing ? 'testing' : status} lastTestedAt={lastTestedAt} />
          {fallbackActive && (
            <span className="fallbackActiveBadge">
              <AlertCircle size={11} /> Fallback active
            </span>
          )}
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {open && (
        <div className="serviceCardBody">
          {children}

          {/* Test result */}
          {testResult && (
            <div className={`testResultBlock ${testResult.ok ? 'testOk' : 'testFail'}`} role="status" aria-live="polite">
              {testResult.ok
                ? <CheckCircle size={13} style={{ flexShrink: 0 }} />
                : <XCircle    size={13} style={{ flexShrink: 0 }} />
              }
              <span>{testResult.message}</span>
              {testResult.fallbackUsed && testResult.fallbackProvider && (
                <span className="testFallbackNote">Fallback: {testResult.fallbackProvider}</span>
              )}
            </div>
          )}

          {/* Test button */}
          {onTest && (
            <div className="serviceCardActions">
              <button
                type="button" className="ghost small"
                onClick={onTest} disabled={testing}
              >
                <FlaskConical size={13} />
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              {lastTestedAt && (
                <span className="settingsHint">
                  Last tested: {new Date(lastTestedAt).toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
