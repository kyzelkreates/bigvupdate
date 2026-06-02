/**
 * ProviderStatusBadge.jsx — Service status indicator
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 */
import { CheckCircle, XCircle, Clock, Wifi, WifiOff, AlertCircle } from 'lucide-react';

const BADGE_CONFIG = {
  success:   { icon: CheckCircle,  label: 'Connected',  cls: 'badge-success'  },
  failed:    { icon: XCircle,      label: 'Failed',     cls: 'badge-failed'   },
  untested:  { icon: Clock,        label: 'Untested',   cls: 'badge-untested' },
  testing:   { icon: Wifi,         label: 'Testing…',   cls: 'badge-testing'  },
  offline:   { icon: WifiOff,      label: 'Offline',    cls: 'badge-failed'   },
  fallback:  { icon: AlertCircle,  label: 'Fallback',   cls: 'badge-fallback' },
};

export default function ProviderStatusBadge({ status = 'untested', lastTestedAt, className = '' }) {
  const cfg   = BADGE_CONFIG[status] || BADGE_CONFIG.untested;
  const Icon  = cfg.icon;
  const ts    = lastTestedAt ? new Date(lastTestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <span className={`providerBadge ${cfg.cls} ${className}`} title={ts ? `Last tested: ${ts}` : undefined}>
      <Icon size={12} />
      {cfg.label}
      {ts && <span className="badgeTs">{ts}</span>}
    </span>
  );
}
