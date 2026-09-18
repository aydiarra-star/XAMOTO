import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ApiAnswer } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks';
import { Card, ErrorBox, Notice, SimulationBanner, Spinner } from '../components';

/**
 * Assistant XAMOTO (§13 → §16).
 *
 * L'assistant explique, il ne diagnostique pas. Chaque réponse affiche
 * l'origine des données disponibles, les données manquantes, les sources
 * citées et le résultat du contrôle anti-hallucination. Quand XAMOTO ne sait
 * pas, il le dit.
 */
interface Message {
  role: 'user' | 'bot';
  text: string;
  answer?: ApiAnswer;
}

export default function AssistantScreen(): JSX.Element {
  const { vehicle, vehicles } = useVehicles();
  const { t, locale } = useI18n();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const lastDiagnostic = useAsync(
    () => api.get<{ diagnostics: Array<{ id: string; dataOrigin: string }> }>(`/api/diagnostics?vehicleId=${vehicle?.id}&limit=1`),
    [vehicle?.id],
    { enabled: Boolean(vehicle) },
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function ask(text: string): Promise<void> {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    setMessages((list) => [...list, { role: 'user', text: trimmed }]);
    setQuestion('');
    setBusy(true);
    setError(null);
    try {
      const answer = await api.post<ApiAnswer>('/api/assistant/ask', {
        question: trimmed,
        vehicleId: vehicle?.id ?? null,
        diagnosticSessionId: lastDiagnostic.data?.diagnostics?.[0]?.id ?? null,
        locale,
      });
      // Le texte est choisi d'après la langue RÉELLEMENT utilisée par
      // l'assistant (une question en wolof reçoit une réponse en français,
      // signalée comme telle), jamais d'après le réglage d'interface seul.
      const effective = answer.language?.effective ?? (locale === 'en' ? 'en' : 'fr');
      setMessages((list) => [...list, { role: 'bot', text: effective === 'en' ? answer.answerEn : answer.answerFr, answer }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Réponse impossible.', 'Could not answer.'));
    } finally {
      setBusy(false);
    }
  }

  const suggestions = [
    t('Qu’est-ce que le code P0420 ?', 'What is code P0420?'),
    t('Puis-je rouler ?', 'Can I drive?'),
    t('Est-ce grave ?', 'Is it serious?'),
    t('Qu’est-ce que le voyant moteur allumé signifie ?', 'What does the check-engine light mean?'),
    t('Que dois-je vérifier avant un long trajet ?', 'What should I check before a long trip?'),
  ];

  const simulated = lastDiagnostic.data?.diagnostics?.[0]?.dataOrigin === 'simulated';

  return (
    <div>
      {simulated && <SimulationBanner />}

      <Card
        title={t('Assistant XAMOTO', 'XAMOTO assistant')}
        subtitle={t(
          'Il explique vos données et le vocabulaire automobile. Il ne remplace pas un diagnostic, et il ne dira jamais une cause qu’il ne peut pas justifier.',
          'It explains your data and automotive vocabulary. It does not replace a diagnosis and will never state a cause it cannot justify.',
        )}
      >
        {!vehicle && vehicles.length === 0 && (
          <Notice tone="warn">
            {t(
              'Sans véhicule enregistré, l’assistant répond uniquement sur des questions générales : il ne peut pas expliquer « vos » données.',
              'Without a registered vehicle, the assistant only answers general questions: it cannot explain “your” data.',
            )}
          </Notice>
        )}

        <div className="chat" style={{ marginTop: 12 }}>
          {messages.length === 0 && (
            <div className="bubble bot">
              <strong>{t('Bonjour, je suis l’assistant XAMOTO.', 'Hello, I am the XAMOTO assistant.')}</strong>
              <div style={{ marginTop: 8 }}>
                {t(
                  'Je peux expliquer un code défaut, une mesure, un test, ou ce que signifie un niveau de sécurité. Si une information manque pour votre véhicule, je vous le dirai.',
                  'I can explain a fault code, a measurement, a test, or what a safety level means. If information is missing for your vehicle, I will tell you.',
                )}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`bubble ${message.role === 'user' ? 'user' : 'bot'} ${message.answer?.refused ? 'refused' : ''}`}>
              {message.text}
              {message.answer && (
                <div className="meta">
                  {/* Si la réponse n'est pas dans la langue demandée, on le dit :
                      jamais de fausse impression de traduction (§40). */}
                  {message.answer.language?.fallback && (
                    <div className="warn">
                      🌍 {locale === 'en' ? message.answer.language.noticeEn : message.answer.language.noticeFr}
                    </div>
                  )}
                  {message.answer.refused && <div>⚠️ {t('XAMOTO signale une limite', 'XAMOTO flags a limit')}</div>}
                  {message.answer.dataDisclosure.availableFacts.length > 0 && (
                    <div>
                      {t('Données utilisées', 'Data used')} : {message.answer.dataDisclosure.availableFacts.join(' · ')}
                    </div>
                  )}
                  {message.answer.dataDisclosure.missingFacts.length > 0 && (
                    <div>
                      {t('Données absentes', 'Missing data')} : {message.answer.dataDisclosure.missingFacts.join(' · ')}
                    </div>
                  )}
                  <div>
                    {t('Moteur', 'Engine')} : {message.answer.engine}
                    {message.answer.llm.used ? ` · ${t('IA générative utilisée et validée', 'generative AI used and validated')}` : ` · ${t('IA déterministe', 'deterministic AI')}`}
                    {message.answer.validation ? ` · ${message.answer.validation.passed ? t('contrôle anti-hallucination : OK', 'anti-hallucination check: OK') : t('réponse rejetée par le contrôle', 'answer rejected by the check')}` : ''}
                  </div>
                </div>
              )}
              {message.answer && message.answer.citations.length > 0 && (
                <div className="citations">
                  <strong>{t('Sources', 'Sources')}</strong>
                  <ul className="clean">
                    {message.answer.citations.map((citation) => (
                      <li key={citation.documentId}>
                        {citation.title} — {citation.publisher} ({citation.reliability}) · {t('score', 'score')} {citation.score.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {busy && <div className="bubble bot"><Spinner label={t('XAMOTO vérifie les données disponibles…', 'XAMOTO is checking available data…')} /></div>}
          <div ref={endRef} />
        </div>

        <ErrorBox message={error} />

        <div className="row" style={{ marginTop: 14 }}>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void ask(question);
            }}
            placeholder={t('Posez votre question…', 'Ask your question…')}
          />
          <button className="button primary" disabled={busy} onClick={() => void ask(question)}>
            {t('Demander', 'Ask')}
          </button>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          {suggestions.map((item) => (
            <button key={item} className="badge outline" style={{ cursor: 'pointer' }} onClick={() => void ask(item)}>
              {item}
            </button>
          ))}
        </div>
      </Card>

      <Card title={t('Ce que l’assistant ne fera jamais', 'What the assistant will never do')}>
        <ul className="clean small">
          <li>{t('Inventer une valeur constructeur, un couple de serrage ou une cause non documentée.', 'Invent a manufacturer value, a tightening torque or an undocumented cause.')}</li>
          <li>{t('Présenter une hypothèse comme une certitude.', 'Present a hypothesis as certainty.')}</li>
          <li>{t('Donner un avis sur un garage, un prix ou une personne.', 'Give an opinion on a garage, a price or a person.')}</li>
          <li>{t('Remplacer l’avis d’un professionnel.', 'Replace professional advice.')}</li>
        </ul>
        <Link className="button small" to="/vehicles">{t('Gérer mes véhicules', 'Manage my vehicles')}</Link>
      </Card>
    </div>
  );
}
