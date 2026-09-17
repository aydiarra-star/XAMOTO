/**
 * XAMOTO — Test de bout en bout (exécution manuelle ou CI).
 *
 * Vérifie la chaîne complète, sans adaptateur physique :
 *   amorçage → compte démo → scan simulé → moteur de diagnostic
 *   → « Puis-je rouler ? » → rapport partageable → assistant IA → API HTTP.
 *
 * Lancement :  XAMOTO_DB_PATH=./data/smoke.sqlite npx tsx tests/smoke.ts
 */
import { buildApp } from '../backend/src/app.js';
import { closeDb } from '../backend/src/db/index.js';
import { DEMO_CREDENTIALS, seedStatus } from '../backend/src/db/seed.js';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, detail = ''): void {
  results.push({ name, ok: condition, detail });
  console.log(`${condition ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main(): Promise<void> {
  console.log('\n=== XAMOTO — test de bout en bout ===\n');
  const app = await buildApp({ seed: true, logger: false });
  await app.ready();

  /* ── 1. Base amorcée ─────────────────────────────────────────────────── */
  const status = seedStatus();
  check('Base de connaissances chargée', status.dtcCodes > 20 && status.documents >= 10, `${status.dtcCodes} codes, ${status.documents} documents, ${status.sources} sources`);
  check('Références véhicules/garages/pièces', status.vehicleSpecs > 5 && status.garages >= 3 && status.parts > 10, `${status.vehicleSpecs} fiches, ${status.garages} garages, ${status.parts} pièces`);
  check('Compte de démonstration et scans simulés', status.vehicles >= 3 && status.scans >= 3 && status.diagnostics >= 3, `${status.vehicles} véhicules, ${status.scans} scans, ${status.diagnostics} diagnostics`);

  /* ── 2. Connexion au compte de démonstration ─────────────────────────── */
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: DEMO_CREDENTIALS.email, password: DEMO_CREDENTIALS.password } });
  check('Connexion du compte de démonstration', login.statusCode === 200, `HTTP ${login.statusCode}`);
  const token = login.json().token as string;
  const auth = { authorization: `Bearer ${token}` };

  const vehiclesResponse = await app.inject({ method: 'GET', url: '/api/vehicles', headers: auth });
  const vehicles = vehiclesResponse.json().vehicles as Array<{ id: string; brand: string; model: string; permission: string }>;
  check('Liste des véhicules', vehiclesResponse.statusCode === 200 && vehicles.length >= 3, `${vehicles.length} véhicules`);

  /* ── 3. Scan simulé : la donnée est marquée comme simulée ────────────── */
  const firstVehicle = vehicles[0];
  const scan = await app.inject({
    method: 'POST',
    url: '/api/scans',
    headers: auth,
    payload: { vehicleId: firstVehicle?.id, mode: 'simulator', scenario: 'multiple_dtc', samples: 6, symptoms: [{ key: 'loss_of_power', present: true }] },
  });
  check('Scan simulé exécuté', scan.statusCode === 201, `HTTP ${scan.statusCode}`);
  const scanBody = scan.json();
  check('Mention MODE SIMULATION présente', typeof scanBody.simulationNotice === 'string' && scanBody.simulationNotice.includes('MODE SIMULATION'), scanBody.simulationNotice ?? '');
  check('Niveau de certitude fourni', Boolean(scanBody.diagnostic?.certainty), String(scanBody.diagnostic?.certainty));
  check('Niveau de sécurité fourni', Boolean(scanBody.diagnostic?.safety), String(scanBody.diagnostic?.safety));
  check('« Puis-je rouler ? » fourni', Boolean(scanBody.diagnostic?.canIDrive?.headlineFr), String(scanBody.diagnostic?.canIDrive?.level));
  check('Données non supportées listées', Array.isArray(scanBody.unsupportedPids), `${scanBody.unsupportedPids?.length ?? 0} PID non supportés`);

  /* ── 4. Moteur : au moins une hypothèse et un test ───────────────────── */
  const hypotheses = scanBody.diagnostic?.hypotheses as Array<{ labelFr: string; certainty: string }> | undefined;
  const tests = scanBody.diagnostic?.tests as Array<{ testKey: string }> | undefined;
  check('Hypothèses produites', (hypotheses?.length ?? 0) > 0, hypotheses?.[0] ? `${hypotheses[0].labelFr} (${hypotheses[0].certainty})` : '');
  check('Tests proposés', (tests?.length ?? 0) > 0, `${tests?.length ?? 0} tests`);
  check(
    'Aucune hypothèse « confirmée » sans test réalisé',
    !(hypotheses ?? []).some((hypothesis) => hypothesis.certainty === 'confirmed'),
    '',
  );

  /* ── 5. Effacement des défauts : refusé sans confirmation ────────────── */
  const clearRefused = await app.inject({ method: 'POST', url: `/api/scans/${scanBody.sessionId}/clear`, headers: auth, payload: { confirm: false } });
  check('Effacement refusé sans confirmation explicite', clearRefused.statusCode === 400, `HTTP ${clearRefused.statusCode}`);

  /* ── 6. Diagnostic : détail, tests, « puis-je rouler ? » ─────────────── */
  const diagnosticId = scanBody.diagnosticSessionId as string;
  const diagnosticDetail = await app.inject({ method: 'GET', url: `/api/diagnostics/${diagnosticId}`, headers: auth });
  check('Détail du diagnostic', diagnosticDetail.statusCode === 200 && Boolean(diagnosticDetail.json().diagnostic?.conclusionFr), '');
  const guided = diagnosticDetail.json().guided as { steps: unknown[] } | undefined;
  check('Parcours guidé généré', (guided?.steps?.length ?? 0) > 0, `${guided?.steps?.length ?? 0} étapes`);

  const canDrive = await app.inject({ method: 'GET', url: `/api/diagnostics/${diagnosticId}/can-i-drive`, headers: auth });
  const canDriveBody = canDrive.json().canIDrive as { disclaimerFr?: string; whyFr?: string[] } | undefined;
  check('« Puis-je rouler ? » avec avertissement de non-garantie', Boolean(canDriveBody?.disclaimerFr?.includes('ne peut pas garantir')), '');
  check('« Puis-je rouler ? » justifié', (canDriveBody?.whyFr?.length ?? 0) > 0, '');

  /* ── 7. Résultat de test : confirmation obligatoire ──────────────────── */
  const testKey = tests?.[0]?.testKey;
  const testRefused = await app.inject({
    method: 'POST',
    url: `/api/diagnostics/${diagnosticId}/tests/${testKey}/result`,
    headers: auth,
    payload: { outcome: 'ok', confirmed: false },
  });
  check('Résultat de test refusé sans confirmation', testRefused.statusCode === 400, `HTTP ${testRefused.statusCode}`);
  const testAccepted = await app.inject({
    method: 'POST',
    url: `/api/diagnostics/${diagnosticId}/tests/${testKey}/result`,
    headers: auth,
    payload: { outcome: 'out_of_range', confirmed: true, note: 'Valeur mesurée hors plage (test automatique)' },
  });
  check('Résultat de test enregistré et diagnostic recalculé', testAccepted.statusCode === 200 && Boolean(testAccepted.json().recalculated?.conclusionFr), '');

  /* ── 8. Rapport partageable + QR ─────────────────────────────────────── */
  const report = await app.inject({ method: 'POST', url: '/api/reports', headers: auth, payload: { vehicleId: firstVehicle?.id, sessionId: diagnosticId } });
  const reportBody = report.json();
  check('Rapport généré', report.statusCode === 201 && Boolean(reportBody.publicUrl), reportBody.publicUrl ?? '');
  check('QR code généré', typeof reportBody.qrDataUrl === 'string' && reportBody.qrDataUrl.startsWith('data:image/png'), '');
  check('Sources du rapport limitées à celles utilisées', (reportBody.payload?.sources?.length ?? 0) > 0, `${reportBody.payload?.sources?.length ?? 0} sources`);
  const publicReport = await app.inject({ method: 'GET', url: `/api/reports/public/${reportBody.shareToken}` });
  check('Rapport consultable par jeton', publicReport.statusCode === 200, `HTTP ${publicReport.statusCode}`);

  /* ── 9. Assistant IA déterministe ────────────────────────────────────── */
  const ask = await app.inject({
    method: 'POST',
    url: '/api/assistant/ask',
    headers: auth,
    payload: { question: 'Puis-je rouler avec ce défaut ?', vehicleId: firstVehicle?.id, locale: 'fr' },
  });
  const askBody = ask.json();
  check('Assistant répond', ask.statusCode === 200 && typeof askBody.answerFr === 'string' && askBody.answerFr.length > 40, `moteur : ${askBody.engine}`);
  check('Réponse tracée (contexte + validation)', Array.isArray(askBody.dataDisclosure?.missingFacts) && Boolean(askBody.validation), `${askBody.dataDisclosure?.missingFacts?.length ?? 0} données annoncées absentes`);

  const offTopic = await app.inject({ method: 'POST', url: '/api/assistant/ask', headers: auth, payload: { question: 'Qui a gagné la coupe du monde de football ?', locale: 'fr' } });
  const offTopicBody = offTopic.json();
  check('Question hors sujet refusée proprement', offTopicBody.refused === true && typeof offTopicBody.refusalReasonFr === 'string', offTopicBody.refusalReasonFr ?? '');

  const unknownDtc = await app.inject({
    method: 'POST',
    url: '/api/assistant/ask',
    headers: auth,
    payload: { question: 'Que signifie le code P1234 ?', vehicleId: firstVehicle?.id, locale: 'fr' },
  });
  check('Code non documenté : XAMOTO annonce l’absence de donnée', unknownDtc.json().answerFr?.includes('Je ne dispose pas de cette donnée'), '');

  /* ── 10. Garages, devis, sincronisation ──────────────────────────────── */
  const garages = await app.inject({ method: 'GET', url: '/api/garages?lat=14.7167&lon=-17.4677', headers: auth });
  check('Annuaire des garages', garages.statusCode === 200 && garages.json().garages.length >= 3, `${garages.json().garages?.length ?? 0} garages`);

  const share = await app.inject({
    method: 'POST',
    url: `/api/garages/${garages.json().garages[0].id}/share-diagnostic`,
    headers: auth,
    payload: { vehicleId: firstVehicle?.id, diagnosticSessionId: diagnosticId, consent: true },
  });
  check('Partage au garage soumis au consentement', share.statusCode === 201, `HTTP ${share.statusCode}`);
  const shareWithoutConsent = await app.inject({
    method: 'POST',
    url: `/api/garages/${garages.json().garages[0].id}/share-diagnostic`,
    headers: auth,
    payload: { vehicleId: firstVehicle?.id, diagnosticSessionId: diagnosticId },
  });
  check('Partage refusé sans consentement', shareWithoutConsent.statusCode === 400, `HTTP ${shareWithoutConsent.statusCode}`);

  const syncPush = await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: auth,
    payload: {
      clientId: 'smoke-device',
      operations: [
        { opId: 'op-1', entity: 'note', action: 'create', vehicleId: firstVehicle?.id, payload: { titleFr: 'Note hors ligne', detail: 'Créée sans réseau' }, clientUpdatedAt: new Date().toISOString(), origin: 'documented' },
      ],
    },
  });
  check('Synchronisation hors ligne', syncPush.statusCode === 200 && syncPush.json().summary?.applied === 1, JSON.stringify(syncPush.json().summary ?? {}));

  /* ── 11. Sécurité : pas de données sans authentification ─────────────── */
  const unauthenticated = await app.inject({ method: 'GET', url: `/api/diagnostics/${diagnosticId}` });
  check('Accès refusé sans jeton', unauthenticated.statusCode === 401, `HTTP ${unauthenticated.statusCode}`);

  const foreign = await app.inject({ method: 'GET', url: '/api/vehicles', headers: auth });
  check('Permissions renvoyées par véhicule', (foreign.json().vehicles as Array<{ permission: string }>).every((vehicle) => vehicle.permission === 'owner'), '');

  await app.close();
  closeDb();

  const failed = results.filter((result) => !result.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} vérifications réussies ===`);
  if (failed.length > 0) {
    console.log('\nÉchecs :');
    for (const result of failed) console.log(`  ✘ ${result.name} ${result.detail}`);
    process.exitCode = 1;
  }
  console.log('');
}

void main().catch((error) => {
  console.error('Test interrompu :', error);
  process.exitCode = 1;
});
