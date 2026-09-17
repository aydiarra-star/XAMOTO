import type { ReactNode } from 'react';
import { CERTAINTY_LABELS, SAFETY_LABELS, ORIGIN_LABELS, useI18n } from './i18n';

export function Card({ title, subtitle, children, actions }: { title?: string; subtitle?: string; children: ReactNode; actions?: ReactNode }): JSX.Element {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="row between">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="hint">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function CertaintyBadge({ level, showHelp = false }: { level: string; showHelp?: boolean }): JSX.Element {
  const { locale } = useI18n();
  const fallback = CERTAINTY_LABELS.unavailable as { fr: string; en: string; color: string; help: string };
  const label = (CERTAINTY_LABELS[level] as typeof fallback | undefined) ?? fallback;
  return (
    <span className="badge" style={{ background: `${label.color}22`, color: label.color, borderColor: `${label.color}66` }} title={showHelp ? label.help : undefined}>
      <span className="dot" style={{ background: label.color }} />
      {locale === 'en' ? label.en : label.fr}
    </span>
  );
}

export function SafetyBadge({ level }: { level: string }): JSX.Element {
  const { locale } = useI18n();
  const fallback = SAFETY_LABELS.normal as { fr: string; en: string; color: string; icon: string };
  const label = (SAFETY_LABELS[level] as typeof fallback | undefined) ?? fallback;
  return (
    <span className="badge" style={{ background: `${label.color}22`, color: label.color, borderColor: `${label.color}66` }} title={label.fr}>
      <span aria-hidden>{label.icon}</span>
      {locale === 'en' ? label.en : label.fr}
    </span>
  );
}

export function OriginBadge({ origin }: { origin: string }): JSX.Element {
  const { locale } = useI18n();
  const fallback = ORIGIN_LABELS.unknown as { fr: string; en: string };
  const label = (ORIGIN_LABELS[origin] as typeof fallback | undefined) ?? fallback;
  const colors: Record<string, string> = { measured: '#22c55e', documented: '#38bdf8', calculated: '#a78bfa', estimated: '#fbbf24', simulated: '#fb923c', unknown: '#94a3b8' };
  const color = colors[origin] ?? colors.unknown ?? '#94a3b8';
  return (
    <span className="badge outline" style={{ color, borderColor: `${color}66` }} title="Origine de la donnée (§33)">
      {locale === 'en' ? label.en : label.fr}
    </span>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'danger' | 'ok' }): JSX.Element {
  return <div className={`notice ${tone === 'info' ? '' : tone}`}>{children}</div>;
}

/** Bandeau obligatoire dès qu'une donnée provient du simulateur (§30, §47.2). */
export function SimulationBanner({ notice }: { notice?: string | null }): JSX.Element {
  const { locale } = useI18n();
  return (
    <div className="simulation-banner" role="status">
      <span aria-hidden>🧪</span>
      <span>
        {locale === 'en'
          ? 'SIMULATION MODE — data not read from a real vehicle.'
          : 'MODE SIMULATION — données non issues d’un véhicule réel.'}
        {notice ? <div className="small" style={{ fontWeight: 400 }}>{notice}</div> : null}
      </span>
    </div>
  );
}

export function Spinner({ label }: { label?: string }): JSX.Element {
  return (
    <span className="row small muted">
      <span className="spinner" aria-hidden />
      {label ?? 'Chargement…'}
    </span>
  );
}

export function ErrorBox({ message }: { message: string | null }): JSX.Element | null {
  if (!message) return null;
  return <div className="error-box" role="alert">{message}</div>;
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }): JSX.Element {
  return (
    <div className="card center">
      <h2>{title}</h2>
      <p className="hint">{message}</p>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }): JSX.Element {
  const color = value >= 80 ? 'var(--ok)' : value >= 60 ? 'var(--warn)' : 'var(--danger)';
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row between small">
        <span>{label}</span>
        <span className="mono">{value}/100</span>
      </div>
      <div className="progress">
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
    </div>
  );
}
