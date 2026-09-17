import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type ApiDiagnostic, type ApiGuidedSession } from '../api';
import { useI18n } from '../i18n';
import { useAction, useAsync, formatDateTime, formatNumber } from '../hooks';
import { Card, CertaintyBadge, EmptyState, ErrorBox, Notice, OriginBadge, SafetyBadge, SimulationBanner, Spinner } from '../components';

interface DiagnosticResponse {
  diagnostic: ApiDiagnostic;
  guided: ApiGuidedSession;
  dataOrigin: string;
  simulationNotice: string | null;
}

const KIND_LABELS: Record<string, { fr: string; en: string }> = {
  dtc: { fr: 'Code défaut', en: 'Fault code' },
  pid: { fr: 'Mesure', en: 'Measurement' },
  symptom: { fr: 'Symptôme', en: 'Symptom' },
  history: { fr: 'Historique', en: 'History' },
  coherence: { fr: 'Cohérence des données', en: 'Data consistency' },
  test: { fr: 'Test', en: 'Test' },
  maintenance: { fr: 'Entretien', en: 'Maintenance' },
};

export default function DiagnosticScreen(): JSX.Element {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<'conclusion' | 'hypotheses' | 'findings' | 'missing' | 'guided'>('conclusion');

  const state = useAsync(() => api.get<DiagnosticResponse>(`/api/diagnostics/${id}`), [id]);
  const report = useAction(async () =>
    api.post<{ id: string; publicUrl: string; shareToken: string; qrDataUrl: string }>('/api/reports', {
      vehicleId: state.data?.diagnostic.vehicleId,
      sessionId: id,
      kind: state.data?.diagnostic.mode === 'inspection' ? 'inspection' : 'diagnostic',
    }),
  );

  if (state.loading) return <Card><Spinner label={t('Chargement du diagnostic…', 'Loading diagnosis…')} /></Card>;
  if (state.error) return <Card><ErrorBox message={state.error} /><Link className="button" to="/">{t('Retour', 'Back')}</Link></Card>;
  if (!state.data) return <EmptyState title={t('Diagnostic introuvable', 'Diagnosis not found')} message="" action={<Link className="button" to="/">{t('Retour', 'Back')}</Link>} />;

  const { diagnostic, guided } = state.data;

  return (
    <div>
      {state.data.simulationNotice && <SimulationBanner notice={state.data.simulationNotice} />}

      <Card
        title={t('Conclusion du moteur XAMOTO', 'XAMOTO engine conclusion')}
        subtitle={`${t('Diagnostic du', 'Diagnosis of')} ${formatDateTime(diagnostic.startedAt, locale)} · ${t('moteur', 'engine')} ${diagnostic.engineVersion} · ${t('mode', 'mode')} ${diagnostic.mode}`}
        actions={
          <div className="row">
            <Link className="button small primary" to={`/diagnostics/${id}/rouler`}>{t('Puis-je rouler ?', 'Can I drive?')}</Link>
            <Link className="button small" to={`/diagnostics/${id}/tests`}>{t('Tests guidés', 'Guided tests')}</Link>
          </div>
        }
      >
        <div className="row" style={{ marginBottom: 10 }}>
          <CertaintyBadge level={diagnostic.certainty} showHelp />
          <SafetyBadge level={diagnostic.safety} />
          {diagnostic.dataOrigin === 'simulated' && <span className="badge outline">MODE SIMULATION</span>}
          <span className="badge outline">{diagnostic.hypotheses.length} {t('hypothèses', 'hypotheses')}</span>
          <span className="badge outline">{diagnostic.tests.length} {t('tests proposés', 'proposed tests')}</span>
        </div>

        <p style={{ fontSize: 16 }}>{locale === 'en' ? diagnostic.conclusionEn : diagnostic.conclusionFr}</p>
        <p className="hint">{diagnostic.disclaimerFr}</p>

        <div className="row" style={{ marginTop: 12 }}>
          <Link className="button small" to={`/reports/${id}`}>{t('Rapport et partage', 'Report and sharing')}</Link>
          <button className="button small" disabled={report.loading} onClick={() => void report.run()}>
            {t('Générer un rapport', 'Generate a report')}
          </button>
          <Link className="button small" to="/post-repair">{t('Comparer après réparation', 'Compare after repair')}</Link>
          <Link className="button small" to="/second-opinion">{t('Seconde opinion', 'Second opinion')}</Link>
        </div>
        <ErrorBox message={report.error} />
        {report.data && (
          <Notice tone="ok">
            {t('Rapport créé.', 'Report created.')} <a href={`/api/reports/public/${report.data.shareToken}`} target="_blank" rel="noreferrer">{report.data.publicUrl}</a>
          </Notice>
        )}
      </Card>

      <div className="tabs">
        <button className={tab === 'conclusion' ? 'active' : ''} onClick={() => setTab('conclusion')}>{t('Constats', 'Findings')}</button>
        <button className={tab === 'hypotheses' ? 'active' : ''} onClick={() => setTab('hypotheses')}>{t('Hypothèses', 'Hypotheses')} ({diagnostic.hypotheses.length})</button>
        <button className={tab === 'findings' ? 'active' : ''} onClick={() => setTab('findings')}>{t('Détail des règles', 'Rule detail')} ({diagnostic.findings.length})</button>
        <button className={tab === 'missing' ? 'active' : ''} onClick={() => setTab('missing')}>{t('Données manquantes', 'Missing data')} ({diagnostic.missingData.length})</button>
        <button className={tab === 'guided' ? 'active' : ''} onClick={() => setTab('guided')}>{t('Parcours guidé', 'Guided flow')}</button>
      </div>

      {tab === 'hypotheses' && (
        <Card subtitle={t('Une hypothèse n’est jamais une certitude : chaque cause affiche son niveau et les tests qui la départagent.', 'A hypothesis is never a certainty: each cause shows its level and the tests that discriminate it.')}>
          {diagnostic.hypotheses.length === 0 && <p className="hint">{t('Aucune cause proposée : les données disponibles ne le permettent pas.', 'No cause proposed: available data does not allow it.')}</p>}
          {diagnostic.hypotheses.map((hypothesis) => (
            <div key={hypothesis.id} className="card" style={{ background: 'var(--bg-soft)', marginBottom: 12 }}>
              <div className="row between">
                <strong>{locale === 'en' ? hypothesis.labelEn : hypothesis.labelFr}</strong>
                <span className="row">
                  <CertaintyBadge level={hypothesis.certainty} />
                  <span className="badge outline mono">{t('score', 'score')} {hypothesis.score.toFixed(2)}</span>
                </span>
              </div>
              {hypothesis.reasoning.length > 0 && (
                <>
                  <h3>{t('Pourquoi', 'Why')}</h3>
                  <ul className="clean small">
                    {hypothesis.reasoning.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                </>
              )}
              {hypothesis.contradicting.length > 0 && (
                <>
                  <h3>{t('Ce qui ne va pas dans ce sens', 'What does not support it')}</h3>
                  <ul className="clean small">
                    {hypothesis.contradicting.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                </>
              )}
              {hypothesis.discriminatingTests.length > 0 && (
                <>
                  <h3>{t('Tests qui tranchent', 'Tests that discriminate')}</h3>
                  <div className="row">
                    {hypothesis.discriminatingTests.map((testKey) => (
                      <Link key={testKey} className="badge outline" to={`/diagnostics/${id}/tests`}>{testKey.replace(/^test_/, '').replace(/_/g, ' ')}</Link>
                    ))}
                  </div>
                </>
              )}
              {hypothesis.parts.length > 0 && (
                <p className="small muted" style={{ marginTop: 8 }}>
                  {t('Pièces possiblement concernées (jamais à remplacer sans test) :', 'Parts possibly involved (never to be replaced without a test):')} {hypothesis.parts.join(', ')}
                </p>
              )}
            </div>
          ))}
        </Card>
      )}

      {tab === 'findings' && (
        <Card subtitle={t('Chaque constat provient d’une règle identifiée appliquée à vos données.', 'Each finding comes from a named rule applied to your data.')}>
          <table>
            <thead>
              <tr>
                <th>{t('Type', 'Type')}</th>
                <th>{t('Constat', 'Finding')}</th>
                <th>{t('Certitude', 'Certainty')}</th>
                <th>{t('Sécurité', 'Safety')}</th>
                <th>{t('Origine', 'Origin')}</th>
              </tr>
            </thead>
            <tbody>
              {diagnostic.findings.map((finding) => (
                <tr key={finding.id}>
                  <td className="small">{KIND_LABELS[finding.kind] ? (locale === 'en' ? KIND_LABELS[finding.kind].en : KIND_LABELS[finding.kind].fr) : finding.kind}</td>
                  <td>
                    <strong>{locale === 'en' ? finding.titleEn : finding.titleFr}</strong>
                    <div className="small muted">{locale === 'en' ? finding.detailEn : finding.detailFr}</div>
                    {finding.evidence.length > 0 && (
                      <div className="small muted">
                        {t('Éléments', 'Evidence')} : {finding.evidence.map((item) => `${item.label}${item.value !== undefined && item.value !== null ? ` = ${item.value}` : ''}`).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td><CertaintyBadge level={finding.certainty} /></td>
                  <td><SafetyBadge level={finding.safety} /></td>
                  <td><OriginBadge origin={finding.origin} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">{t('Règles appliquées', 'Rules fired')} : {diagnostic.rulesFired.join(', ') || '—'}</p>
        </Card>
      )}

      {tab === 'missing' && (
        <Card subtitle={t('XAMOTO préfère dire ce qu’il ignore plutôt que de compléter par une estimation.', 'XAMOTO prefers to state what it ignores rather than fill in with an estimate.')}>
          {diagnostic.missingData.length === 0 && <p className="hint">{t('Aucune donnée manquante signalée par le moteur.', 'No missing data reported by the engine.')}</p>}
          <ul className="clean">
            {diagnostic.missingData.map((item, index) => (
              <li key={index}>
                {locale === 'en' ? item.en : item.fr}
                {item.blocksConclusion && <span className="badge outline" style={{ marginLeft: 8 }}>{t('bloque la conclusion', 'blocks conclusion')}</span>}
              </li>
            ))}
          </ul>
          {diagnostic.nextSteps.length > 0 && (
            <>
              <h3>{t('Prochaines étapes proposées', 'Suggested next steps')}</h3>
              <ul className="clean">
                {diagnostic.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {tab === 'guided' && (
        <Card subtitle={`${guided.totalSteps} ${t('étapes', 'steps')} · ${formatNumber(guided.progressPercent)} %`}>
          <div className="progress" style={{ marginBottom: 14 }}>
            <div style={{ width: `${guided.progressPercent}%` }} />
          </div>
          {guided.steps.map((step) => (
            <div key={step.index} className="card" style={{ background: 'var(--bg-soft)', marginBottom: 10 }}>
              <div className="row between">
                <strong>
                  {step.index + 1}. {locale === 'en' ? step.titleEn : step.titleFr}
                </strong>
                <span className="badge outline">{step.kind}</span>
              </div>
              <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{locale === 'en' ? step.bodyEn : step.bodyFr}</p>
              {step.question && <Notice>{locale === 'en' ? step.question.en : step.question.fr}</Notice>}
            </div>
          ))}
          <Link className="button primary" to={`/diagnostics/${id}/tests`}>{t('Réaliser les tests proposés', 'Perform the proposed tests')}</Link>
        </Card>
      )}
    </div>
  );
}
