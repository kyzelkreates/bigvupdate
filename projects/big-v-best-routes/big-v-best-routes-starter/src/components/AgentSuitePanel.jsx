/**
 * AgentSuitePanel.jsx — 4P3X Specialist AI Agent Suite Display
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Renders the full output of all 6 specialist agents in a collapsible panel.
 * Shows: overall level, headline, per-agent status, findings, readiness checklist,
 *        driver advisory messages, and action items.
 *
 * Advisory only — never displays legal guarantees.
 */

import { useState } from 'react';
import {
  ChevronDown, ChevronUp, Brain, Shield, Map, Navigation,
  CheckCircle, AlertCircle, AlertTriangle, Info, XCircle,
  Truck, Database, ShieldCheck, Route, Clock, List,
} from 'lucide-react';

const LEVEL_META = {
  clear:    { color: 'var(--green)',   icon: CheckCircle,   label: 'Clear'    },
  info:     { color: 'var(--muted)',   icon: Info,          label: 'Info'     },
  caution:  { color: 'var(--blue)',    icon: Info,          label: 'Caution'  },
  warning:  { color: 'var(--warning)', icon: AlertTriangle, label: 'Warning'  },
  critical: { color: 'var(--danger)',  icon: AlertCircle,   label: 'Critical' },
};

const AGENT_META = {
  vehicle_constraint_agent:    { label: 'Vehicle Constraints',    icon: Truck },
  restriction_data_agent:      { label: 'Restriction Data',        icon: Database },
  legal_compliance_agent:      { label: 'Legal Advisory',          icon: Shield },
  safety_route_agent:          { label: 'Safety Route',            icon: Route },
  navigation_readiness_agent:  { label: 'Navigation Readiness',    icon: Navigation },
  driver_advisory_agent:       { label: 'Driver Advisory',         icon: Brain },
};

export default function AgentSuitePanel({ agents }) {
  const [expanded,        setExpanded]        = useState(false);
  const [expandedAgent,   setExpandedAgent]   = useState(null);
  const [showActions,     setShowActions]      = useState(false);
  const [showChecklist,   setShowChecklist]    = useState(false);

  if (!agents?.ranAt) {
    return (
      <section className="panel agentPanel">
        <div className="agentPanelHeader" onClick={() => setExpanded((v) => !v)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Brain size={18} style={{ color: 'var(--muted)' }} />
            <div>
              <p className="eyebrow">4P3X Intelligent AI</p>
              <h3 style={{ margin: 0, fontSize: 15 }}>Specialist Agent Suite</h3>
            </div>
          </div>
          <span className="badge" style={{ color: 'var(--muted)' }}>Not yet run</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, padding: '10px 0 0' }}>
          Run Compliance AI or calculate a route to activate the 4P3X specialist agent suite.
        </p>
      </section>
    );
  }

  const level    = agents.overallLevel || 'info';
  const meta     = LEVEL_META[level] || LEVEL_META.info;
  const LevelIcon = meta.icon;
  const advisory = agents.driverAdvisory;
  const readiness = agents.readinessAgent;

  return (
    <section className="panel agentPanel">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="agentPanelHeader"
        onClick={() => setExpanded((v) => !v)}
        style={{ cursor: 'pointer' }}
        role="button"
        aria-expanded={expanded}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <Brain size={18} style={{ color: meta.color, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow">4P3X Intelligent AI — Specialist Agents</p>
            <h3 style={{ margin: 0, fontSize: 15, color: meta.color, lineHeight: 1.3 }}>
              {agents.headline}
            </h3>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className={`badge ${levelBadgeClass(level)}`}>
            <LevelIcon size={11} style={{ display: 'inline', marginRight: 3 }} />
            {meta.label}
          </span>
          <span className="badge">{agents.combinedScore ?? '—'}%</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* ── Collapsed summary ──────────────────────────────────────────── */}
      {!expanded && advisory?.messages?.length > 0 && (
        <div style={{ paddingTop: 8 }}>
          {advisory.messages.slice(0, 2).map((msg, i) => (
            <div key={i} className={`agentMessage ${msg.level}`} style={{ marginBottom: 6 }}>
              <strong>{msg.heading}</strong>
              <p>{msg.body}</p>
            </div>
          ))}
          {advisory.messages.length > 2 && (
            <button className="ghost" style={{ fontSize: 12, padding: '4px 0', color: 'var(--muted)' }}
              onClick={(e) => { e.stopPropagation(); setExpanded(true); }}>
              + {advisory.messages.length - 2} more findings…
            </button>
          )}
        </div>
      )}

      {/* ── Expanded content ────────────────────────────────────────────── */}
      {expanded && (
        <div className="agentPanelBody">

          {/* All driver advisory messages */}
          {advisory?.messages?.map((msg, i) => (
            <div key={i} className={`agentMessage ${msg.level}`}>
              <strong>{msg.heading}</strong>
              <p>{msg.body}</p>
            </div>
          ))}

          {/* Score grid */}
          <div className="agentScoreGrid">
            <div className="agentScoreItem">
              <span>Combined</span>
              <strong style={{ color: scoreColor(agents.combinedScore) }}>{agents.combinedScore ?? '—'}%</strong>
            </div>
            <div className="agentScoreItem">
              <span>Legal advisory</span>
              <strong style={{ color: scoreColor(agents.legalAgent?.advisoryScore) }}>
                {agents.legalAgent?.advisoryScore ?? '—'}%
              </strong>
            </div>
            <div className="agentScoreItem">
              <span>Route safety</span>
              <strong style={{ color: scoreColor(agents.safetyAgent?.routeSafetyScore) }}>
                {agents.safetyAgent?.routeSafetyScore ?? '—'}%
              </strong>
            </div>
            <div className="agentScoreItem">
              <span>Nav readiness</span>
              <strong style={{ color: scoreColor(agents.readinessAgent?.readinessScore) }}>
                {agents.readinessAgent?.readinessScore ?? '—'}%
              </strong>
            </div>
          </div>

          {/* Agent status rows */}
          <div className="agentStatusList">
            {[
              agents.vehicleAgent,
              agents.restrictionAgent,
              agents.legalAgent,
              agents.safetyAgent,
            ].filter(Boolean).map((agent) => {
              const am = AGENT_META[agent.agentId] || { label: agent.agentId, icon: Info };
              const AgentIcon = am.icon;
              const sev = agent.severity || 'info';
              const sevMeta = LEVEL_META[sev] || LEVEL_META.info;
              const SevIcon = sevMeta.icon;
              const isOpen = expandedAgent === agent.agentId;
              const findingsList = agent.findings || agent.advisoryItems || [];

              return (
                <div key={agent.agentId} className="agentStatusRow">
                  <button
                    className="agentStatusHeader ghost"
                    onClick={() => setExpandedAgent(isOpen ? null : agent.agentId)}
                    aria-expanded={isOpen}
                  >
                    <AgentIcon size={14} style={{ color: sevMeta.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>{am.label}</span>
                    <span style={{ fontSize: 12, color: sevMeta.color }}>
                      <SevIcon size={11} style={{ display: 'inline', marginRight: 3 }} />
                      {agent.status?.replaceAll('_', ' ')}
                    </span>
                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {isOpen && findingsList.length > 0 && (
                    <ul className="agentFindingsList">
                      {findingsList.map((f, fi) => (
                        <li key={fi} className={`agentFinding ${f.severity}`}>
                          <strong>{f.title}</strong>
                          {f.detail && <p>{f.detail}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {isOpen && findingsList.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 0 6px 22px' }}>
                      No findings from this agent.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation readiness checklist */}
          {readiness?.checklist?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button
                className="ghost"
                style={{ fontSize: 13, padding: '6px 0', display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}
                onClick={() => setShowChecklist((v) => !v)}
              >
                <List size={14} />
                Navigation readiness ({readiness.readyCount}/{readiness.totalChecks} checks passed)
                {showChecklist ? <ChevronUp size={13} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={13} style={{ marginLeft: 'auto' }} />}
              </button>

              {showChecklist && (
                <ul className="readinessChecklist">
                  {readiness.checklist.map((c) => (
                    <li key={c.id} className={`readinessItem ${c.passed ? 'passed' : c.blocker ? 'blocked' : 'missing'}`}>
                      {c.passed
                        ? <CheckCircle size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                        : c.blocker
                          ? <XCircle size={13} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                          : <AlertTriangle size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                      }
                      <span>
                        <strong>{c.label}</strong>
                        {!c.passed && <p>{c.detail}</p>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Action items */}
          {advisory?.actions?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button
                className="ghost"
                style={{ fontSize: 13, padding: '6px 0', display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}
                onClick={() => setShowActions((v) => !v)}
              >
                <Clock size={14} />
                {advisory.actions.length} recommended action(s)
                {showActions ? <ChevronUp size={13} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={13} style={{ marginLeft: 'auto' }} />}
              </button>

              {showActions && (
                <ul className="agentActionList">
                  {advisory.actions.map((action, i) => (
                    <li key={i} className="agentActionItem">
                      <span style={{ color: 'var(--green)', marginRight: 6, flexShrink: 0 }}>→</span>
                      {action}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Restriction conflict map markers info */}
          {(agents.restrictionAgent?.matchedRestrictions?.length || 0) > 0 && (
            <div className="restrictionConflictList">
              <p style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, marginBottom: 6 }}>
                ⛔ {agents.restrictionAgent.matchedRestrictions.length} restriction conflict(s) near route:
              </p>
              {agents.restrictionAgent.matchedRestrictions.map((r, i) => (
                <div key={i} className="restrictionConflictItem">
                  <span style={{ color: 'var(--danger)', fontSize: 12 }}>
                    {r.type.replace('_', ' ').toUpperCase()} — {r.desc}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                    Limit: {r.value} · Your vehicle: {r.vehicleValue}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Run time */}
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14 }}>
            4P3X agents ran at {new Date(agents.ranAt).toLocaleTimeString()} ·
            Powered by 4P3X Intelligent AI · Advisory only
          </p>
        </div>
      )}
    </section>
  );
}

function levelBadgeClass(level) {
  switch (level) {
    case 'clear':    return 'green';
    case 'caution':  return '';
    case 'warning':  return 'warning';
    case 'critical': return 'danger';
    default:         return '';
  }
}

function scoreColor(score) {
  if (score == null) return 'var(--muted)';
  if (score >= 75) return 'var(--green)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--danger)';
}
