/**
 * NavigationSafetyPanel.jsx — Compliance AI + safety status panel
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Surfaces GPS/nav-aware compliance warnings during active navigation.
 * Receives augmented compliance result (with navigationStatus injected).
 * Always shows the COMPLIANCE_DISCLAIMER.
 *
 * ADVISORY ONLY — outputs never guarantee legal route compliance.
 * Drivers remain responsible for all live road signs and legal requirements.
 */

import { Shield, TriangleAlert, CheckCircle, XCircle, AlertCircle, Satellite } from 'lucide-react';
import { COMPLIANCE_DISCLAIMER } from '../../services/rerouteService.js';

// ─── Level config ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  danger:   { icon: XCircle,       cls: 'compWarnDanger', label: 'Critical' },
  warning:  { icon: TriangleAlert, cls: 'compWarnWarning', label: 'Warning' },
  info:     { icon: AlertCircle,   cls: 'compWarnInfo',    label: 'Advisory' },
  success:  { icon: CheckCircle,   cls: 'compWarnSuccess', label: 'OK' },
};

function WarnItem({ warning }) {
  const cfg  = LEVEL_CONFIG[warning.level] || LEVEL_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className={`navSafetyWarnItem ${cfg.cls}`} role="listitem">
      <Icon size={13} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        {warning.title && <div className="warnTitle">{warning.title}</div>}
        {warning.detail && <div className="warnDetail">{warning.detail}</div>}
      </div>
    </div>
  );
}

// ─── GPS nav-status warnings (generated client-side from SSOT) ───────────────

function buildNavigationStatusWarnings(navigation, serviceConfig) {
  const warnings = [];
  const nav = navigation || {};

  // GPS unavailable
  if (nav.locationPermission === 'denied') {
    warnings.push({
      id: 'gps-denied', level: 'warning',
      title: 'GPS permission denied',
      detail: 'Live position tracking is unavailable. Route guidance is positional-estimate only.',
    });
  }
  if (nav.locationPermission === 'unavailable') {
    warnings.push({
      id: 'gps-unavailable', level: 'warning',
      title: 'GPS unavailable',
      detail: 'This device/browser does not support geolocation. Navigation uses simulated position.',
    });
  }

  // GPS stale
  if (nav.gpsIsStale && nav.gpsStatus === 'real') {
    warnings.push({
      id: 'gps-stale', level: 'warning',
      title: 'GPS signal stale',
      detail: 'No position update received recently. Route progress tracking may be inaccurate.',
    });
  }

  // Low GPS accuracy
  if (nav.gpsAccuracy != null && nav.gpsAccuracy > 75 && nav.gpsStatus === 'real') {
    warnings.push({
      id: 'gps-low-accuracy', level: 'info',
      title: `Low GPS accuracy (±${Math.round(nav.gpsAccuracy)}m)`,
      detail: 'Off-route detection threshold may be affected. Verify route on-screen.',
    });
  }

  // Off-route
  if (nav.offRouteStatus) {
    warnings.push({
      id: 'off-route', level: 'warning',
      title: 'Possible off-route deviation',
      detail: `Position is ${Math.round(nav.offRouteDistanceM || 0)}m from the planned route. Re-check route suitability.`,
    });
  }

  // Map provider fallback
  const mapCfg = serviceConfig?.mapping;
  if (mapCfg?.lastFallbackProvider === 'maplibre_public' && mapCfg?.status === 'failed') {
    warnings.push({
      id: 'map-fallback', level: 'info',
      title: 'Map provider fallback active',
      detail: 'Configured map provider failed. Using public OSM/MapLibre fallback. Route data unaffected.',
    });
  }

  // Routing provider failed
  const rteCfg = serviceConfig?.routing;
  if (rteCfg?.status === 'failed') {
    warnings.push({
      id: 'routing-failed', level: 'danger',
      title: 'Routing provider not responding',
      detail: 'Route data may be stale. Do not rely on current route guidance for safety-critical decisions.',
    });
  }

  return warnings;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NavigationSafetyPanel({
  compliance,
  navigation,
  serviceConfig,
  compact = false,
}) {
  const navWarnings = buildNavigationStatusWarnings(navigation, serviceConfig);
  const compWarnings = compliance?.warnings || [];
  const overallLevel = compliance?.level || null;
  const allWarnings  = [...navWarnings, ...compWarnings];
  const hasWarnings  = allWarnings.length > 0;

  // ── Compact mode: just a badge ─────────────────────────────────────────────
  if (compact) {
    const hasError   = allWarnings.some((w) => w.level === 'danger');
    const hasWarning = allWarnings.some((w) => w.level === 'warning');
    const cls = hasError ? 'badge-failed' : hasWarning ? 'badge-fallback' : 'badge-success';
    const Icon = hasError ? XCircle : hasWarning ? TriangleAlert : Shield;
    return (
      <span className={`providerBadge ${cls}`}>
        <Icon size={12} />
        {hasError ? 'Compliance alerts' : hasWarning ? 'Compliance warnings' : 'Compliance OK'}
        {allWarnings.length > 0 && <span style={{ marginLeft: 3 }}>({allWarnings.length})</span>}
      </span>
    );
  }

  return (
    <div className="navSafetyPanel" role="region" aria-label="Navigation Safety and Compliance">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="navSafetyHeader">
        <Shield size={15} />
        <span>Safety &amp; Compliance AI</span>
        {navigation?.gpsStatus === 'real' && navigation?.gpsWatchActive && (
          <span className="navSafetyGpsBadge">
            <Satellite size={11} /> Live GPS
          </span>
        )}
      </div>

      {/* ── Compliance score / status ─────────────────────────────────── */}
      {compliance?.score != null && (
        <div className={`navSafetyScore ${overallLevel === 'high_risk' || overallLevel === 'route_unavailable' ? 'scoreDanger' : overallLevel === 'needs_review' ? 'scoreWarn' : 'scoreOk'}`}>
          <span className="scorePct">{compliance.score}%</span>
          <span className="scoreLabel">
            {compliance.advisoryStatus?.replace(/_/g, ' ') || 'Advisory score'}
          </span>
        </div>
      )}

      {/* ── Warning list ──────────────────────────────────────────────── */}
      {hasWarnings && (
        <div className="navSafetyWarnList" role="list">
          {allWarnings.map((w, i) => (
            <WarnItem key={w.id || i} warning={w} />
          ))}
        </div>
      )}

      {!hasWarnings && (
        <div className="navSafetyOk">
          <CheckCircle size={13} />
          <span>No active compliance warnings.</span>
        </div>
      )}

      {/* ── Compliance AI disclaimer — always visible ─────────────────── */}
      <div className="navSafetyDisclaimer" role="note">
        <Shield size={11} style={{ flexShrink: 0 }} />
        <span>{COMPLIANCE_DISCLAIMER}</span>
      </div>
    </div>
  );
}
