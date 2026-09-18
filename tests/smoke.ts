/**
 * XAMOTO — Test de bout en bout (exécution manuelle ou CI).
 *
 * Vérifie la chaîne complète, sans adaptateur physique :
 *   amorçage → compte démo → scan simulé → moteur de diagnostic
 *   → « Puis-je rouler ? » → rapport partageable → assistant IA → API HTTP.
 *
 * Lancement :  XAMOTO_DB_PATH=./data/smoke.sqlite npx tsx tests/smoke.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const here = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  console.log('\n=== XAMOTO — test de bout en bout ===\n');
  const app = await buildApp({ seed: true, logger: false });
  await app.ready();

  /* ── 1. Base amorcée ─────────────────────────────────────────────────── */
  const status = seedStatus();
  // Les compteurs sont toujours présents après amorçage ; ?? 0 évite de propager
  // un « undefined » dans un message d'échec.
  const counts = {
    sources: status.sources ?? 0,
    documents: status.documents ?? 0,
    dtcCodes: status.dtcCodes ?? 0,
    vehicleSpecs: status.vehicleSpecs ?? 0,
    garages: status.garages ?? 0,
    parts: status.parts ?? 0,
    vehicles: status.vehicles ?? 0,
    scans: status.scans ?? 0,
    diagnostics: status.diagnostics ?? 0,
  };
  check('Base de connaissances chargée', counts.dtcCodes > 20 && counts.documents >= 10, `${counts.dtcCodes} codes, ${counts.documents} documents, ${counts.sources} sources`);
  check('Références véhicules/garages/pièces', counts.vehicleSpecs > 5 && counts.garages >= 3 && counts.parts > 10, `${counts.vehicleSpecs} fiches, ${counts.garages} garages, ${counts.parts} pièces`);
  check('Compte de démonstration et scans simulés', counts.vehicles >= 3 && counts.scans >= 3 && counts.diagnostics >= 3, `${counts.vehicles} véhicules, ${counts.scans} scans, ${counts.diagnostics} diagnostics`);

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

  /* ── 3 bis. Bluetooth : XAMOTO annonce ce qu'il peut faire, rien de plus ── */
  const candidates = await app.inject({ method: 'GET', url: '/api/obd/candidates', headers: auth });
  const candidatesBody = candidates.json();
  check(
    'État Bluetooth annoncé honnêtement',
    candidates.statusCode === 200 && typeof candidatesBody.bluetooth?.available === 'boolean' && typeof candidatesBody.bluetooth?.noticeFr === 'string',
    `disponible : ${String(candidatesBody.bluetooth?.available)} — ${candidatesBody.bluetooth?.noticeFr ?? ''}`,
  );
  const bluetooth = await app.inject({ method: 'GET', url: '/api/obd/bluetooth/devices', headers: auth });
  const bluetoothBody = bluetooth.json();
  const bluetoothHonest =
    bluetooth.statusCode === 200 &&
    Array.isArray(bluetoothBody.devices) &&
    // Soit un pilote existe et la liste est réelle, soit il n'existe pas et elle
    // est vide AVEC une explication. Jamais une liste inventée sans pilote.
    (bluetoothBody.available ? bluetoothBody.devices.length >= 0 : bluetoothBody.devices.length === 0 && typeof bluetoothBody.hintFr === 'string') &&
    bluetoothBody.certainty === 'presumption';
  check('Aucun appareil Bluetooth inventé sans pilote', bluetoothHonest, `disponible : ${String(bluetoothBody.available)}, appareils : ${bluetoothBody.devices?.length ?? 0}`);

  /* ── 3 ter. Multilingue : le wolof est annoncé, jamais inventé (§40) ── */
  const assistantWo = await app.inject({
    method: 'POST',
    url: '/api/assistant/ask',
    headers: auth,
    payload: { question: 'Puis-je rouler ?', locale: 'wo', vehicleId: firstVehicle?.id ?? null },
  });
  const assistantWoBody = assistantWo.json();
  check(
    'Question en wolof : réponse honnêtement signalée en français',
    assistantWo.statusCode === 200 &&
      assistantWoBody.language?.requested === 'wo' &&
      assistantWoBody.language?.effective === 'fr' &&
      assistantWoBody.language?.fallback === true &&
      typeof assistantWoBody.language?.noticeFr === 'string' &&
      assistantWoBody.language.noticeFr.includes('wolof'),
    `langue effective : ${assistantWoBody.language?.effective ?? 'inconnue'}`,
  );
  check(
    'Langue wolof acceptée par l’API (aucune erreur de saisie)',
    assistantWo.statusCode !== 400,
    `HTTP ${assistantWo.statusCode}`,
  );

  /* ── 3 quater. Couverture par système : dire ce qu'on ne peut pas lire ── */
  const systems = await app.inject({ method: 'GET', url: '/api/knowledge/systems', headers: auth });
  const systemsBody = systems.json() as { systems?: Array<{ system: string; readability: string; limitsFr: string; ruleIds: string[]; genericRuleCount: number }>; noticeFr?: string };
  const coverageList = systemsBody.systems ?? [];
  const airbag = coverageList.find((item) => item.system === 'airbag');
  check(
    'Couverture par système exposée pour toutes les parties du véhicule',
    systems.statusCode === 200 && coverageList.length >= 15 && coverageList.every((item) => item.limitsFr.length > 20),
    `${coverageList.length} systèmes`,
  );
  check(
    'Un système non lisible est annoncé comme tel, jamais comme sain',
    airbag?.readability === 'not_accessible' && typeof systemsBody.noticeFr === 'string',
    `airbag : ${airbag?.readability ?? 'absent'}`,
  );
  check(
    'Les règles dédiées et les règles générales sont distinguées',
    coverageList.every((item) => Array.isArray(item.ruleIds)) && (coverageList[0]?.genericRuleCount ?? 0) > 0,
    `${coverageList[0]?.genericRuleCount ?? 0} règles générales`,
  );

  /* ── 3 quinquies. Freinage : un code de châssis ne désigne pas une pièce ── */
  const absScan = await app.inject({
    method: 'POST',
    url: '/api/scans',
    headers: auth,
    payload: { vehicleId: firstVehicle?.id, mode: 'simulator', scenario: 'abs_fault', samples: 4 },
  });
  const absBody = absScan.json();
  const absDiagnostic = absBody.diagnostic ?? {};
  const absFindings: Array<{ titleFr?: string; certainty?: string }> = absDiagnostic.findings ?? [];
  const absHypotheses: Array<{ labelFr?: string; certainty?: string }> = absDiagnostic.hypotheses ?? [];
  check(
    'Scénario de freinage disponible (code de châssis sans mesure de roue)',
    absScan.statusCode === 201 && (absBody.dtcs ?? []).some((dtc: { code: string }) => dtc.code.startsWith('C')),
    (absBody.dtcs ?? []).map((dtc: { code: string }) => dtc.code).join(', '),
  );
  check(
    'Freinage : XAMOTO rappelle que le code désigne un circuit, pas une pièce',
    absFindings.some((finding) => (finding.titleFr ?? '').includes('circuit')),
    absFindings.map((finding) => finding.titleFr).filter(Boolean).slice(0, 3).join(' | '),
  );
  check(
    'Freinage : aucune hypothèse « confirmée » sur un système non lisible',
    absHypotheses.length > 0 && absHypotheses.every((hypothesis) => hypothesis.certainty !== 'confirmed'),
    absHypotheses.map((hypothesis) => hypothesis.certainty).join(', ') || 'aucune hypothèse',
  );

  /* ── 3 sexies. Mobile : la lecture se fait sur le téléphone, le calcul non ── */
  const localScan = await app.inject({
    method: 'POST',
    url: '/api/scans',
    headers: auth,
    payload: {
      vehicleId: firstVehicle?.id,
      mode: 'local',
      local: {
        protocol: 'ISO 15765-4 (CAN 11/500)',
        device: { id: 'elm327-ble', label: 'ELM327 v1.5 (Bluetooth)', kind: 'bluetooth' },
        milOn: true,
        readings: [
          { key: 'engine_rpm', value: 780, supported: true, origin: 'measured' },
          { key: 'coolant_temp', value: 108, supported: true, origin: 'measured' },
          { key: 'battery_voltage', value: 12.4, supported: true, origin: 'measured' },
          { key: 'oil_temp', value: null, supported: false },
        ],
        dtcs: [{ code: 'P0128', status: 'active' }, { code: 'C0035', status: 'stored' }],
      },
    },
  });
  const localBody = localScan.json();
  check(
    'Scan local accepté : le téléphone lit, le serveur calcule',
    localScan.statusCode === 201 && typeof localBody.diagnosticSessionId === 'string',
    `HTTP ${localScan.statusCode}`,
  );
  check(
    'Scan local : aucune mention MODE SIMULATION et provenance mesurée',
    localScan.statusCode === 201 && localBody.simulationNotice === null && localBody.source === 'obd',
    `source : ${String(localBody.source)} — avis : ${String(localBody.simulationNotice)}`,
  );
  check(
    'Scan local : un PID non supporté est listé, jamais remplacé par une valeur',
    (localBody.unsupportedPids ?? []).includes('oil_temp') &&
      (localBody.readings ?? []).every((reading: { key: string; value: number | null }) => reading.key !== 'oil_temp' || reading.value === null),
    `${(localBody.unsupportedPids ?? []).length} PID non supportés`,
  );

  const simulatedLocally = await app.inject({
    method: 'POST',
    url: '/api/scans',
    headers: auth,
    payload: {
      vehicleId: firstVehicle?.id,
      mode: 'local',
      local: { milOn: false, readings: [{ key: 'coolant_temp', value: 90, supported: true, origin: 'simulated' }], dtcs: [] },
    },
  });
  const simulatedLocallyBody = simulatedLocally.body ?? '';
  check(
    'Une donnée simulée envoyée comme locale est refusée',
    // Le refus est explicite : le message dit POURQUOI (le simulateur vit sur le
    // serveur), il ne se contente pas de « champ invalide ».
    simulatedLocally.statusCode === 400 && /simul/i.test(simulatedLocallyBody),
    `HTTP ${simulatedLocally.statusCode}`,
  );

  const unknownPidLocally = await app.inject({
    method: 'POST',
    url: '/api/scans',
    headers: auth,
    payload: {
      vehicleId: firstVehicle?.id,
      mode: 'local',
      local: { milOn: false, readings: [{ key: 'pression_pneus', value: 2.4, supported: true, origin: 'measured' }], dtcs: [] },
    },
  });
  check(
    'Un PID que XAMOTO ne sait pas lire est refusé, pas enregistré',
    unknownPidLocally.statusCode === 400 && String(unknownPidLocally.json().error?.message ?? '').includes('PID inconnu'),
    `HTTP ${unknownPidLocally.statusCode}`,
  );

  const emptyLocally = await app.inject({
    method: 'POST',
    url: '/api/scans',
    headers: auth,
    payload: { vehicleId: firstVehicle?.id, mode: 'local', local: { milOn: false, readings: [], dtcs: [] } },
  });
  check(
    'Un scan local vide ne produit pas un « tout va bien »',
    emptyLocally.statusCode === 400,
    `HTTP ${emptyLocally.statusCode}`,
  );

  /* ── 3 septies. Mobile : chemins ET verbes HTTP confrontés au serveur ───── */
  // L'application mobile (Dart) ne peut pas être compilée ici : aucun SDK n'est
  // téléchargeable depuis cet environnement. Ce qui se vérifie SANS compilateur,
  // en revanche, c'est son contrat avec le serveur — et c'est là que se cachent
  // les erreurs coûteuses (route inexistante, verbe HTTP erroné). Ce contrôle a
  // déjà trouvé deux défauts réels : `GET /api/knowledge/dtc/:code` n'existait
  // pas, et la synchronisation utilisait POST au lieu de GET.
  const mobileRoot = resolve(here, '../app/mobile');
  const endpointsSource = readFileSync(resolve(mobileRoot, 'lib/api/endpoints.dart'), 'utf8');
  const constants = new Map<string, string>();
  for (const match of endpointsSource.matchAll(/static const String (\w+) = '(\/api\/[^']*)'/g)) {
    constants.set(match[1]!, match[2]!);
  }

  const hasRoute = (app as unknown as { hasRoute: (route: { method: string; url: string }) => boolean }).hasRoute.bind(app);
  const mobileCalls: Array<{ method: string; path: string; file: string }> = [];
  const unsupportedCalls: string[] = [];

  for (const file of [
    'lib/state/app_state.dart',
    'lib/state/sync_service.dart',
    'lib/screens/login_screen.dart',
    'lib/screens/vehicles_screen.dart',
    'lib/screens/guided_tests_screen.dart',
    'lib/screens/assistant_screen.dart',
    'lib/screens/report_screen.dart',
    'lib/screens/maintenance_screen.dart',
    'lib/screens/garages_screen.dart',
  ]) {
    const source = readFileSync(resolve(mobileRoot, file), 'utf8');
    // Un appel peut choisir son chemin dans une expression (`demo ? Api.demo :
    // Api.login`) : on lit donc TOUTES les constantes citées dans la parenthèse.
    for (const call of source.matchAll(/api\.(get|post|patch|delete)\(([\s\S]{0,240}?)\)/g)) {
      const method = call[1]!.toUpperCase();
      const args = call[2] ?? '';
      for (const reference of args.matchAll(/Api\.(\w+)/g)) {
        // Les assistants se terminent par « Path » et portent le nom de la constante.
        const name = reference[1]!.replace(/Path$/, '');
        const path = constants.get(name);
        if (!path) {
          unsupportedCalls.push(`${file}: Api.${reference[1]}`);
          continue;
        }
        mobileCalls.push({ method, path, file });
      }
    }
  }

  const wrongCalls = mobileCalls.filter((call) => !hasRoute({ method: call.method, url: call.path }));
  check(
    'Application mobile : chaque appel (verbe + chemin) existe côté serveur',
    mobileCalls.length >= 12 && wrongCalls.length === 0 && unsupportedCalls.length === 0,
    wrongCalls.length > 0 || unsupportedCalls.length > 0
      ? [...wrongCalls.map((call) => `${call.method} ${call.path}`), ...unsupportedCalls].join(', ')
      : `${mobileCalls.length} appels vérifiés sur ${new Set(mobileCalls.map((call) => call.path)).size} routes`,
  );

  // Toute constante déclarée doit correspondre à une route réelle : une constante
  // fausse mais jamais appelée est une bombe à retardement pour le prochain écran.
  const unusedWrong = [...constants.entries()].filter(([, path]) => !hasRoute({ method: 'GET', url: path }) && !hasRoute({ method: 'POST', url: path }) && !hasRoute({ method: 'DELETE', url: path }) && !hasRoute({ method: 'PATCH', url: path }));
  check(
    'Application mobile : aucune constante de chemin ne pointe vers une route absente',
    unusedWrong.length === 0,
    unusedWrong.map(([name, path]) => `${name} → ${path}`).join(', ') || `${constants.size} constantes vérifiées`,
  );

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

  /* ── 10 bis. Devis : ce que le garage a écrit, et rien de plus ─────────── */
  // Le devis est le document où il est le plus tentant d'inventer : un prix, un
  // « c'est cher », une pièce non mesurée. Ces contrôles vérifient l'inverse.
  const quoteWithAmount = await app.inject({
    method: 'POST',
    url: '/api/quotes',
    headers: auth,
    payload: {
      vehicleId: firstVehicle?.id,
      garageId: garages.json().garages[0].id,
      diagnosticSessionId: diagnosticId,
      title: 'Contrôle e2e',
      status: 'received',
      lines: [
        { label: 'Poste fondé sur une mesure', quantity: 1, unitAmount: 30000, currency: 'XOF' },
        { label: 'Poste hors périmètre OBD', quantity: 1, unitAmount: 20000, currency: 'XOF' },
      ],
    },
  });
  check('Devis enregistré tel que le garage l’a écrit', quoteWithAmount.statusCode === 201, `HTTP ${quoteWithAmount.statusCode}`);
  const createdQuote = quoteWithAmount.json().quote as { id: string; lines: unknown[] } | null;
  check(
    'Le devis créé est renvoyé complet',
    quoteWithAmount.json().id === createdQuote?.id && Array.isArray(createdQuote?.lines),
    `lignes : ${createdQuote?.lines?.length ?? 0}`,
  );
  const createdQuoteId = createdQuote?.id;

  const quoteWithoutAmount = await app.inject({
    method: 'POST',
    url: '/api/quotes',
    headers: auth,
    payload: {
      vehicleId: firstVehicle?.id,
      garageId: garages.json().garages[0].id,
      title: 'Devis incomplet',
      lines: [{ label: 'Poste sans montant', quantity: 1 }],
    },
  });
  check('Ligne sans montant refusée plutôt que complétée à zéro', quoteWithoutAmount.statusCode === 400, `HTTP ${quoteWithoutAmount.statusCode}`);

  const quoteAnalysis = await app.inject({ method: 'POST', url: `/api/quotes/${createdQuoteId}/analysis`, headers: auth, payload: {} });
  const analysisBody = quoteAnalysis.json();
  check('Analyse du devis', quoteAnalysis.statusCode === 200 && Array.isArray(analysisBody.analysis), `HTTP ${quoteAnalysis.statusCode}`);
  check(
    'Analyse : chaque poste classé soutenu par une mesure, ou non',
    (analysisBody.analysis as Array<{ linkedToMeasuredData: boolean }>).every((line) => typeof line.linkedToMeasuredData === 'boolean'),
    `${analysisBody.summary?.linesLinkedToMeasuredData ?? 0} soutenu(s), ${analysisBody.summary?.linesNotLinked ?? 0} sans lien`,
  );
  check(
    'Analyse : un poste non mesuré devient une question, pas un soupçon',
    (analysisBody.analysis as Array<{ linkedToMeasuredData: boolean; questionToAsk: string | null }>)
      .filter((line) => !line.linkedToMeasuredData)
      .every((line) => typeof line.questionToAsk === 'string' && line.questionToAsk.length > 0),
    `${analysisBody.questionsFr?.length ?? 0} questions`,
  );
  // Les mots de jugement sont cherchés UNIQUEMENT là où ils affirment quelque
  // chose. Le texte de XAMOTO contient volontairement « un devis sans lien avec
  // les données n'est pas forcément injustifié » : c'est la phrase inverse d'un
  // jugement, et un simple `includes()` la prendrait pour un délit.
  const analysisText = JSON.stringify(analysisBody).toLowerCase();
  const negation = ['pas', 'aucun', 'jamais', 'ni ', 'sans'];
  const judgements = ['cher', 'anormal', 'injustifié', 'arnaque', 'trop élevé', 'excessif'];
  const assertedJudgements = judgements.filter((word) => {
    let index = analysisText.indexOf(word);
    while (index !== -1) {
      const before = analysisText.slice(Math.max(0, index - 40), index);
      if (!negation.some((marker) => before.includes(marker))) return true;
      index = analysisText.indexOf(word, index + 1);
    }
    return false;
  });
  check('Analyse : aucun jugement de prix affirmé', assertedJudgements.length === 0, assertedJudgements.join(', '));
  check('Analyse : la mention d’origine des données est portée', typeof analysisBody.summary?.dataOrigin === 'string', String(analysisBody.summary?.dataOrigin));
  check(
    'Devis sans lien mesuré : dite comme telle, jamais comme une faute',
    !analysisText.includes('faute') && !analysisText.includes('tromperie'),
    '',
  );

  const quoteOnlyGarage = await app.inject({
    method: 'POST',
    url: '/api/quotes',
    headers: auth,
    payload: {
      vehicleId: firstVehicle?.id,
      garageId: garages.json().garages[0].id,
      title: 'Devis hors diagnostic',
      lines: [{ label: 'Vidange moteur et filtres', quantity: 1, unitAmount: 25000, currency: 'XOF' }],
    },
  });
  const noLinkAnalysis = await app.inject({ method: 'POST', url: `/api/quotes/${quoteOnlyGarage.json().quote?.id}/analysis`, headers: auth, payload: {} });
  check(
    'Devis sans diagnostic lié analysé sans erreur',
    noLinkAnalysis.statusCode === 200 && noLinkAnalysis.json().summary?.linesLinkedToMeasuredData === 0,
    `HTTP ${noLinkAnalysis.statusCode} — ${noLinkAnalysis.json().summary?.linesLinkedToMeasuredData} lié(s)`,
  );

  const demoQuotes = await app.inject({ method: 'GET', url: `/api/quotes?vehicleId=${firstVehicle?.id}`, headers: auth });
  check(
    'Le compte de démonstration contient un devis à confronter',
    demoQuotes.statusCode === 200 && demoQuotes.json().quotes.length >= 1,
    `${demoQuotes.json().quotes?.length ?? 0} devis`,
  );
  check(
    'Le devis de démonstration annonce des montants fictifs',
    (demoQuotes.json().quotes as Array<{ factualSummary?: string }>).every((quote) => !quote.factualSummary || quote.factualSummary.includes('fictif') || quote.factualSummary.includes('fictifs')),
    '',
  );

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
