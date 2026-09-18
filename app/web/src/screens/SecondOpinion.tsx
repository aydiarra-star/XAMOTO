import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ApiDiagnostic } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAction, useAsync, formatDateTime } from '../hooks';
import { Card, CertaintyBadge, EmptyState, ErrorBox, Notice, Spinner } from '../components';

interface Opinion {
  confirmedElements: Array<{ label: string; certainty: string; why: string }>;
  unconfirmedElements: Array<{ label: string; why: string }>;
  alternativeHypotheses: Array<{ id: string; labelFr: string; labelEn: string; certainty: string; score: number }>;
  additionalTests: Array<{ testKey: string; title: string; objective: string; priority: number }>;
  summaryFr: string;
  summaryEn: string;
  disclaimerFr: string;
  disclaimerEn: string;
  questionsFr: string[];
  questionsEn: string[];
}

/**
 * Seconde opinion (§20).
 *
 * XAMOTO ne juge pas un garage et ne dit jamais « bon » ou « mauvais » prix.
 * Il confronte le diagnostic reçu aux données mesurées et propose des
 * questions à poser.
 */
export default function SecondOpinionScreen(): JSX.Element {
  const { vehicle, vehicles } = useVehicles();
  const { t, locale } = useI18n();
  const [diagnosticId, setDiagnosticId] = useState('');
  const [externalDiagnosis, setExternalDiagnosis] = useState('');
  const [externalCauses, setExternalCauses] = useState('');
  const [proposedRepair, setProposedRepair] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [currency, setCurrency] = useState('XOF');

  const diagnostics = useAsync(
    () => api.get<{ diagnostics: ApiDiagnostic[] }>(`/api/diagnostics?vehicleId=${vehicle?.id}&limit=20`),
    [vehicle?.id],
    { enabled: Boolean(vehicle) },
  );

  const opinion = useAction(async (id: string) =>
    api.post<{ secondOpinion: Opinion; notice: string }>(`/api/diagnostics/${id}/second-opinion`, {
      externalDiagnosis,
      externalCauses: externalCauses
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      proposedRepair: proposedRepair || null,
      proposedAmount: proposedAmount === '' ? null : Number(proposedAmount),
      currency,
    }),
  );

  if (vehicles.length === 0) {
    return <EmptyState title={t('Aucun véhicule', 'No vehicle')} message={t('Ajoutez un véhicule et lancez un scan.', 'Add a vehicle and run a scan.')} action={<Link className="button primary" to="/vehicles">{t('Ajouter un véhicule', 'Add a vehicle')}</Link>} />;
  }

  const list = diagnostics.data?.diagnostics ?? [];
  const result = opinion.data?.secondOpinion;

  return (
    <div>
      <Card
        title={t('Seconde opinion', 'Second opinion')}
        subtitle={t(
          'Indiquez ce qu’on vous a dit et ce qu’on vous propose. XAMOTO compare avec vos données mesurées — sans juger le garage.',
          'Enter what you were told and what is proposed. XAMOTO compares it with your measured data — without judging the garage.',
        )}
      >
        {!diagnostics.loading && list.length === 0 && (
          <Notice tone="warn">{t('Lancez d’abord un scan : sans données XAMOTO, il n’y a rien à comparer.', 'Run a scan first: without XAMOTO data there is nothing to compare.')}</Notice>
        )}

        <div className="field-row">
          <div>
            <label htmlFor="diag">{t('Diagnostic XAMOTO de référence', 'Reference XAMOTO diagnosis')}</label>
            <select id="diag" value={diagnosticId} onChange={(event) => setDiagnosticId(event.target.value)}>
              <option value="">{t('Choisir…', 'Choose…')}</option>
              {list.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDateTime(item.startedAt, locale)} — {item.certainty} / {item.safety}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label htmlFor="external">{t('Diagnostic reçu (texte du garage, du vendeur…)', 'Diagnosis received (garage, seller…)')}</label>
        <textarea id="external" rows={3} value={externalDiagnosis} onChange={(event) => setExternalDiagnosis(event.target.value)} placeholder={t('Ex : « catalyseur à remplacer »', 'e.g. “catalytic converter to be replaced”')} />

        <label htmlFor="causes">{t('Causes annoncées (séparées par des virgules)', 'Stated causes (comma separated)')}</label>
        <input id="causes" value={externalCauses} onChange={(event) => setExternalCauses(event.target.value)} />

        <div className="field-row">
          <div>
            <label htmlFor="repair">{t('Réparation proposée', 'Proposed repair')}</label>
            <input id="repair" value={proposedRepair} onChange={(event) => setProposedRepair(event.target.value)} />
          </div>
          <div>
            <label htmlFor="amount">{t('Montant annoncé (optionnel)', 'Quoted amount (optional)')}</label>
            <input id="amount" type="number" value={proposedAmount} onChange={(event) => setProposedAmount(event.target.value)} />
          </div>
          <div>
            <label htmlFor="currency">{t('Devise', 'Currency')}</label>
            <select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="XOF">FCFA (XOF)</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="MAD">MAD</option>
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="button primary" disabled={!diagnosticId || externalDiagnosis.trim().length < 3 || opinion.loading} onClick={() => void opinion.run(diagnosticId)}>
            {t('Demander la seconde opinion', 'Request the second opinion')}
          </button>
          <span className="hint">{t('Le montant n’est jamais jugé : il sert seulement à recalculer un prix par ligne si vous le souhaitez.', 'The amount is never judged: it only serves to compute a per-line price if you wish.')}</span>
        </div>
        <ErrorBox message={opinion.error} />
      </Card>

      {opinion.loading && <Card><Spinner label={t('Comparaison en cours…', 'Comparing…')} /></Card>}

      {result && (
        <>
          <Card title={t('Synthèse', 'Summary')}>
            <p>{locale === 'en' ? result.summaryEn : result.summaryFr}</p>
            <Notice tone="warn">{locale === 'en' ? result.disclaimerEn : result.disclaimerFr}</Notice>
          </Card>

          <div className="grid cols-2">
            <Card title={t('Ce que vos données confirment', 'What your data confirms')}>
              {result.confirmedElements.length === 0 && <p className="hint">{t('Aucun élément confirmé par les données disponibles.', 'No element confirmed by the available data.')}</p>}
              <ul className="clean">
                {result.confirmedElements.map((element) => (
                  <li key={element.label}>
                    <strong>{element.label}</strong> <CertaintyBadge level={element.certainty} />
                    <div className="small muted">{element.why}</div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title={t('Ce que vos données ne confirment pas', 'What your data does not confirm')}>
              {result.unconfirmedElements.length === 0 && <p className="hint">{t('Aucun élément non confirmé signalé.', 'No unconfirmed element reported.')}</p>}
              <ul className="clean">
                {result.unconfirmedElements.map((element) => (
                  <li key={element.label}>
                    <strong>{element.label}</strong>
                    <div className="small muted">{element.why}</div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title={t('Autres causes possibles', 'Other possible causes')} subtitle={t('Elles restent possibles tant qu’un test ne les a pas écartées.', 'They remain possible until a test rules them out.')}>
            <ul className="clean">
              {result.alternativeHypotheses.map((hypothesis) => (
                <li key={hypothesis.id}>
                  <strong>{locale === 'en' ? hypothesis.labelEn : hypothesis.labelFr}</strong> <CertaintyBadge level={hypothesis.certainty} />
                </li>
              ))}
            </ul>
          </Card>

          <Card title={t('Tests qui manquent pour trancher', 'Tests missing to decide')}>
            <ul className="clean">
              {result.additionalTests.map((test) => (
                <li key={test.testKey}>
                  <strong>{test.title}</strong> — {test.objective}
                </li>
              ))}
            </ul>
          </Card>

          <Card title={t('Questions à poser', 'Questions to ask')}>
            <ul className="clean">
              {(locale === 'en' ? result.questionsEn : result.questionsFr).map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
            <Notice>{opinion.data?.notice}</Notice>
          </Card>
        </>
      )}
    </div>
  );
}
