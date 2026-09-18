import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ApiDiagnostic, type ApiGarage, type ApiQuote, type ApiQuoteAnalysis } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAction, useAsync, formatDate, formatNumber } from '../hooks';
import { Card, EmptyState, ErrorBox, Notice, Spinner } from '../components';

/**
 * Devis (§27).
 *
 * Trois règles gouvernent cet écran, et elles expliquent chaque détail :
 *
 *  1. **XAMOTO ne saisit aucun montant à la place du garage.** Une ligne sans
 *     montant reste vide et bloque l'enregistrement : un « 0 » enregistré
 *     deviendrait un prix, donc une donnée inventée (§47-1).
 *  2. **Aucun jugement de valeur.** L'analyse ne dit jamais « cher », « anormal »
 *     ou « injustifié » : elle dit quelles lignes rejoignent une donnée mesurée
 *     sur le véhicule, et quelles questions poser.
 *  3. **Un devis sans lien avec le diagnostic n'est pas une preuve de faute.**
 *     Freinage, climatisation, carrosserie ne sont pas lisibles par l'OBD : le
 *     rappel est affiché avec l'analyse, pas caché dans une note de bas de page.
 */

interface DraftLine {
  label: string;
  quantity: string;
  unitAmount: string;
}

const STATUS_LABELS: Record<ApiQuote['status'], { fr: string; en: string }> = {
  draft: { fr: 'Brouillon', en: 'Draft' },
  requested: { fr: 'Demandé', en: 'Requested' },
  received: { fr: 'Reçu', en: 'Received' },
  accepted: { fr: 'Accepté', en: 'Accepted' },
  declined: { fr: 'Refusé', en: 'Declined' },
};

export default function QuotesScreen(): JSX.Element {
  const { vehicle, vehicles } = useVehicles();
  const { t, locale } = useI18n();

  const [garageId, setGarageId] = useState('');
  const [diagnosticSessionId, setDiagnosticSessionId] = useState('');
  const [status, setStatus] = useState<ApiQuote['status']>('received');
  const [lines, setLines] = useState<DraftLine[]>([{ label: '', quantity: '1', unitAmount: '' }]);
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [delayDays, setDelayDays] = useState('');
  const [factualSummary, setFactualSummary] = useState('');
  const [analysis, setAnalysis] = useState<ApiQuoteAnalysis | null>(null);

  const garages = useAsync(() => api.get<{ garages: ApiGarage[] }>('/api/garages?country=SN'), []);
  const diagnostics = useAsync(
    () => api.get<{ diagnostics: ApiDiagnostic[] }>(`/api/diagnostics?vehicleId=${vehicle?.id}&limit=10`),
    [vehicle?.id],
    { enabled: Boolean(vehicle) },
  );
  const quotes = useAsync(
    () => api.get<{ quotes: ApiQuote[] }>(`/api/quotes?vehicleId=${vehicle?.id}`),
    [vehicle?.id],
    { enabled: Boolean(vehicle) },
  );

  const create = useAction(async () => {
    const result = await api.post<{ quote: ApiQuote }>('/api/quotes', {
      vehicleId: vehicle?.id,
      garageId,
      diagnosticSessionId: diagnosticSessionId || null,
      title: t('Devis reçu', 'Received quote'),
      status,
      lines: lines.map((line) => ({
        label: line.label.trim(),
        quantity: Number(line.quantity) || 1,
        unitAmount: Number(line.unitAmount),
        currency: 'XOF',
      })),
      warrantyMonths: warrantyMonths === '' ? null : Number(warrantyMonths),
      delayDays: delayDays === '' ? null : Number(delayDays),
      factualSummary: factualSummary.trim() || null,
    });
    quotes.reload();
    return result;
  });

  const analyse = useAction(async (quoteId: string) =>
    api.post<ApiQuoteAnalysis>(`/api/quotes/${quoteId}/analysis`, {}),
  );

  /** Lignes proposées à partir du diagnostic réellement enregistré (§9). */
  const suggestedLines = useMemo(() => {
    const list = diagnostics.data?.diagnostics ?? [];
    return list.slice(0, 3).map((diagnostic) => ({
      id: diagnostic.id,
      label: `${formatDate(diagnostic.startedAt, locale)} — ${diagnostic.conclusionFr.slice(0, 90)}`,
      hypotheses: diagnostic.hypotheses ?? [],
    }));
  }, [diagnostics.data, locale]);

  const selectedDiagnostic = useMemo(
    () => (diagnostics.data?.diagnostics ?? []).find((diagnostic) => diagnostic.id === diagnosticSessionId) ?? null,
    [diagnostics.data, diagnosticSessionId],
  );

  /** Complète les libellés à partir des pièces réellement citées par le diagnostic. */
  function prefillFromDiagnostic(): void {
    const parts = new Set<string>();
    for (const hypothesis of selectedDiagnostic?.hypotheses ?? []) {
      for (const part of hypothesis.parts ?? []) parts.add(part.replace(/_/g, ' '));
    }
    const labels = parts.size > 0 ? [...parts] : [];
    if (labels.length === 0) {
      setLines([{ label: '', quantity: '1', unitAmount: '' }]);
      return;
    }
    // Le montant reste VIDE : c'est au garage de le donner, pas à XAMOTO.
    setLines(labels.map((label) => ({ label, quantity: '1', unitAmount: '' })));
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        title={t('Aucun véhicule', 'No vehicle')}
        message={t('Ajoutez un véhicule : un devis se rapporte toujours à un véhicule précis.', 'Add a vehicle: a quote always refers to a specific vehicle.')}
        action={<Link className="button primary" to="/vehicles">{t('Ajouter un véhicule', 'Add a vehicle')}</Link>}
      />
    );
  }

  const totalOf = (quote: ApiQuote): number => quote.lines.reduce((sum, line) => sum + (line.unitAmount ?? 0) * (line.quantity ?? 1), 0);
  const incompleteLines = lines.filter((line) => line.label.trim().length > 0 && (line.unitAmount === '' || Number.isNaN(Number(line.unitAmount))));
  const canSave = Boolean(vehicle && garageId) && lines.some((line) => line.label.trim().length > 0) && incompleteLines.length === 0;

  return (
    <div className="grid">
      <Card
        title={t('Devis reçu d’un garage', 'Quote received from a garage')}
        subtitle={t(
          'XAMOTO enregistre ce que le garage a écrit. Il ne complète aucun montant et ne juge aucun prix.',
          'XAMOTO records what the garage wrote. It fills in no amount and judges no price.',
        )}
      >
        <div className="field-row">
          <div>
            <label htmlFor="quote-garage">{t('Garage', 'Garage')}</label>
            <select id="quote-garage" value={garageId} onChange={(event) => setGarageId(event.target.value)}>
              <option value="">{t('Choisir un garage…', 'Choose a garage…')}</option>
              {(garages.data?.garages ?? []).map((garage) => (
                <option key={garage.id} value={garage.id}>
                  {garage.name} — {garage.city}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quote-diagnostic">{t('Rattaché au diagnostic', 'Linked to the diagnosis')}</label>
            <select id="quote-diagnostic" value={diagnosticSessionId} onChange={(event) => setDiagnosticSessionId(event.target.value)}>
              <option value="">{t('Aucun (devis seul)', 'None (quote alone)')}</option>
              {suggestedLines.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quote-status">{t('État', 'Status')}</label>
            <select id="quote-status" value={status} onChange={(event) => setStatus(event.target.value as ApiQuote['status'])}>
              {(['requested', 'received', 'accepted', 'declined'] as const).map((value) => (
                <option key={value} value={value}>
                  {locale === 'en' ? STATUS_LABELS[value].en : STATUS_LABELS[value].fr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <button className="button small ghost" type="button" onClick={prefillFromDiagnostic} disabled={!selectedDiagnostic}>
            {t('Reprendre les pièces citées par le diagnostic', 'Use the parts cited by the diagnosis')}
          </button>
          <span className="hint">
            {t(
              'Les libellés sont repris tels quels ; les montants restent à saisir, ils viennent du garage.',
              'Labels are reused as-is; amounts remain to be entered, they come from the garage.',
            )}
          </span>
        </div>

        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>{t('Poste', 'Line')}</th>
              <th style={{ width: 90 }}>{t('Qté', 'Qty')}</th>
              <th style={{ width: 140 }}>{t('Montant unitaire (FCFA)', 'Unit amount (XOF)')}</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <input
                    value={line.label}
                    placeholder={t('Ex. : remplacement de la sonde amont', 'E.g. replace upstream sensor')}
                    onChange={(event) => {
                      const next = [...lines];
                      next[index] = { ...line, label: event.target.value };
                      setLines(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    value={line.quantity}
                    onChange={(event) => {
                      const next = [...lines];
                      next[index] = { ...line, quantity: event.target.value };
                      setLines(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    value={line.unitAmount}
                    placeholder={t('à saisir', 'to enter')}
                    onChange={(event) => {
                      const next = [...lines];
                      next[index] = { ...line, unitAmount: event.target.value };
                      setLines(next);
                    }}
                  />
                </td>
                <td>
                  <button
                    className="button small ghost"
                    type="button"
                    onClick={() => setLines(lines.filter((_, position) => position !== index))}
                    disabled={lines.length === 1}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ marginTop: 8 }}>
          <button className="button small" type="button" onClick={() => setLines([...lines, { label: '', quantity: '1', unitAmount: '' }])}>
            {t('Ajouter un poste', 'Add a line')}
          </button>
        </div>

        <div className="field-row" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="warranty">{t('Garantie annoncée (mois)', 'Stated warranty (months)')}</label>
            <input id="warranty" inputMode="numeric" value={warrantyMonths} onChange={(event) => setWarrantyMonths(event.target.value)} />
          </div>
          <div>
            <label htmlFor="delay">{t('Délai annoncé (jours)', 'Stated lead time (days)')}</label>
            <input id="delay" inputMode="numeric" value={delayDays} onChange={(event) => setDelayDays(event.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label htmlFor="factual">
            {t('Ce que le garage a écrit (facultatif)', 'What the garage wrote (optional)')}
          </label>
          <textarea
            id="factual"
            rows={2}
            value={factualSummary}
            onChange={(event) => setFactualSummary(event.target.value)}
            placeholder={t('Recopiez ses mots, sans les interpréter.', 'Copy their words, without interpreting them.')}
          />
        </div>

        {incompleteLines.length > 0 && (
          <Notice tone="warn">
            {t(
              `${incompleteLines.length} poste(s) sans montant : XAMOTO n’enregistre pas un devis avec des montants inventés.`,
              `${incompleteLines.length} line(s) without an amount: XAMOTO does not store a quote with invented amounts.`,
            )}
          </Notice>
        )}

        <div className="row" style={{ marginTop: 10 }}>
          <button className="button primary" type="button" disabled={!canSave || create.loading} onClick={() => void create.run()}>
            {create.loading ? t('Enregistrement…', 'Saving…') : t('Enregistrer le devis', 'Save the quote')}
          </button>
        </div>
        <ErrorBox message={create.error} />
        {create.data && (
          <Notice tone="ok">
            {t('Devis enregistré. Vous pouvez l’analyser ci-dessous.', 'Quote saved. You can analyse it below.')}
          </Notice>
        )}
      </Card>

      <Card
        title={t('Mes devis', 'My quotes')}
        subtitle={t(
          'Montants déclarés par le garage, tels quels. XAMOTO ne les compare à aucun « prix normal ».',
          'Amounts declared by the garage, as-is. XAMOTO compares them to no “normal price”.',
        )}
      >
        {quotes.loading && <Spinner label={t('Chargement des devis…', 'Loading quotes…')} />}
        <ErrorBox message={quotes.error} />
        {(quotes.data?.quotes ?? []).length === 0 && !quotes.loading && (
          <p className="muted">{t('Aucun devis enregistré pour ce véhicule.', 'No quote stored for this vehicle.')}</p>
        )}
        {(quotes.data?.quotes ?? []).map((quote) => (
          <div key={quote.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{locale === 'en' ? STATUS_LABELS[quote.status].en : STATUS_LABELS[quote.status].fr}</strong>
                <div className="small muted">
                  {(garages.data?.garages ?? []).find((garage) => garage.id === quote.garageId)?.name ?? quote.garageId} ·{' '}
                  {formatDate(quote.receivedAt ?? quote.requestedAt, locale)}
                </div>
              </div>
              <div className="mono">{formatNumber(totalOf(quote))} FCFA</div>
            </div>
            <ul className="small">
              {quote.lines.map((line, index) => (
                <li key={index}>
                  {line.label} — {line.quantity} × {formatNumber(line.unitAmount)} FCFA
                </li>
              ))}
            </ul>
            <button className="button small" type="button" disabled={analyse.loading} onClick={() => void analyse.run(quote.id)}>
              {t('Analyser ce devis', 'Analyse this quote')}
            </button>
          </div>
        ))}
        <ErrorBox message={analyse.error} />
      </Card>

      {analysis && (
        <Card
          title={t('Analyse factuelle du devis', 'Factual analysis of the quote')}
          subtitle={t(
            'Ce que XAMOTO peut confronter aux données mesurées, et ce qu’il vous reste à demander.',
            'What XAMOTO can confront with measured data, and what you still have to ask.',
          )}
        >
          <div className="grid cols-3">
            <div className="stat">
              <div className="value mono">{analysis.summary.totalLines}</div>
              <div className="label">{t('Postes', 'Lines')}</div>
            </div>
            <div className="stat">
              <div className="value mono">{analysis.summary.linesLinkedToMeasuredData}</div>
              <div className="label">{t('Soutenus par une mesure', 'Backed by a measurement')}</div>
            </div>
            <div className="stat">
              <div className="value mono">{analysis.summary.linesNotLinked}</div>
              <div className="label">{t('Sans lien mesuré', 'No measured link')}</div>
            </div>
          </div>

          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>{t('Poste', 'Line')}</th>
                <th>{t('Lien avec les mesures', 'Link with measurements')}</th>
                <th>{t('À demander', 'To ask')}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.analysis.map((line, index) => (
                <tr key={index}>
                  <td>{line.label}</td>
                  <td>
                    {line.linkedToMeasuredData ? (
                      <span className="badge outline">
                        {line.matchedElements.length > 0 ? line.matchedElements.join(', ') : t('oui', 'yes')}
                      </span>
                    ) : (
                      <span className="badge">{t('aucun lien trouvé', 'no link found')}</span>
                    )}
                  </td>
                  <td className="small">{line.questionToAsk ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Notice tone="warn">{analysis.noticeFr}</Notice>

          <h4>{t('Questions à poser au garage', 'Questions to ask the garage')}</h4>
          <ul className="small">
            {analysis.questionsFr.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
