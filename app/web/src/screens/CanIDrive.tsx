import { Link, useParams } from 'react-router-dom';
import { api, type ApiCanIDrive } from '../api';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks';
import { Card, CertaintyBadge, EmptyState, ErrorBox, SafetyBadge, SimulationBanner, Spinner } from '../components';

/**
 * « Puis-je rouler ? » (§12).
 *
 * Réponse volontairement prudente : elle dépend des données disponibles, du
 * moment du scan, et ne constitue jamais une garantie. L'avertissement de
 * non-garantie est affiché tel quel, avant la réponse.
 */
export default function CanIDriveScreen(): JSX.Element {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();

  const state = useAsync(async () => {
    const [answer, diagnostic] = await Promise.all([
      api.get<{ canIDrive: ApiCanIDrive; notice: string }>(`/api/diagnostics/${id}/can-i-drive`),
      api.get<{ dataOrigin: string; simulationNotice: string | null }>(`/api/diagnostics/${id}`),
    ]);
    return { ...answer, simulationNotice: diagnostic.simulationNotice };
  }, [id]);

  if (state.loading) return <Card><Spinner label={t('Évaluation de la sécurité…', 'Assessing safety…')} /></Card>;
  if (state.error) {
    return (
      <Card>
        <ErrorBox message={state.error} />
        <p className="hint">
          {t(
            'Aucune conclusion « Puis-je rouler ? » n’est disponible pour ce diagnostic. Dans ce cas, XAMOTO ne répond pas à votre place : faites contrôler le véhicule.',
            'No “Can I drive?” conclusion is available for this diagnosis. In that case XAMOTO does not answer for you: have the vehicle checked.',
          )}
        </p>
        <Link className="button" to={`/diagnostics/${id}`}>{t('Retour au diagnostic', 'Back to diagnosis')}</Link>
      </Card>
    );
  }
  if (!state.data) return <EmptyState title={t('Indisponible', 'Unavailable')} message="" action={<Link className="button" to="/">{t('Retour', 'Back')}</Link>} />;

  const answer = state.data.canIDrive;
  const why = locale === 'en' ? answer.whyEn : answer.whyFr;
  const toCheck = locale === 'en' ? answer.toCheckEn : answer.toCheckFr;
  const avoid = locale === 'en' ? answer.avoidEn : answer.avoidFr;

  return (
    <div>
      {state.data.simulationNotice && <SimulationBanner notice={state.data.simulationNotice} />}

      <Card
        title={t('Puis-je rouler ?', 'Can I drive?')}
        subtitle={t('Réponse fondée uniquement sur les données disponibles pour ce véhicule.', 'Answer based only on the data available for this vehicle.')}
        actions={<SafetyBadge level={answer.level} />}
      >
        <p style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{locale === 'en' ? answer.headlineEn : answer.headlineFr}</p>
        <div className="row">
          <CertaintyBadge level={answer.certainty} showHelp />
          <span className="badge outline">{t('Niveau de sécurité', 'Safety level')} : {answer.level}</span>
        </div>

        <div className="notice danger" style={{ marginTop: 14 }}>
          <strong>{t('Avertissement de non-garantie', 'No-guarantee disclaimer')}</strong>
          <div>{locale === 'en' ? answer.disclaimerEn : answer.disclaimerFr}</div>
          <small>{state.data.notice}</small>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title={t('Pourquoi cette réponse', 'Why this answer')}>
          <ul className="clean">
            {why.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
          {answer.dataUsed.length > 0 && (
            <>
              <h3>{t('Données utilisées', 'Data used')}</h3>
              <ul className="clean small">
                {answer.dataUsed.map((item, index) => (
                  <li key={index}>
                    {item.label}
                    {item.value !== undefined && item.value !== null ? ` = ${item.value}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title={t('À vérifier avant de partir', 'Check before driving')}>
          {toCheck.length === 0 ? (
            <p className="hint">{t('Aucune vérification particulière n’a été identifiée dans les données disponibles.', 'No specific check was identified in the available data.')}</p>
          ) : (
            <ul className="clean">
              {toCheck.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          )}
          {avoid.length > 0 && (
            <>
              <h3>{t('À éviter', 'What to avoid')}</h3>
              <ul className="clean">
                {avoid.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </>
          )}
          <h3>{t('Quand consulter', 'When to seek help')}</h3>
          <p className="small">{locale === 'en' ? answer.seeProfessionalEn : answer.seeProfessionalFr}</p>
        </Card>
      </div>

      <Card title={t('Données manquantes pour conclure', 'Missing data to conclude')}>
        {answer.missingData.length === 0 ? (
          <p className="hint">{t('Aucune donnée manquante signalée pour cette évaluation.', 'No missing data reported for this assessment.')}</p>
        ) : (
          <ul className="clean">
            {answer.missingData.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <Link className="button" to={`/diagnostics/${id}/tests`}>{t('Faire les tests proposés', 'Run the proposed tests')}</Link>
          <Link className="button ghost" to={`/diagnostics/${id}`}>{t('Voir le diagnostic complet', 'See full diagnosis')}</Link>
        </div>
      </Card>
    </div>
  );
}
