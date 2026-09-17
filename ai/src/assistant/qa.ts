/**
 * XAMOTO — Assistant IA contextuel (§13, §14, §16).
 *
 * Deux modes de fonctionnement, dans cet ordre :
 *
 *  1. MODE DÉTERMINISTE (par défaut, sans clé LLM) : les réponses sont
 *     COMPOSÉES à partir du moteur de diagnostic, de la base documentaire et
 *     du contexte véhicule. Zéro hallucination possible : chaque phrase
 *     provient d'une donnée ou d'un document identifié.
 *
 *  2. MODE LLM (optionnel) : le LLM reformule et dialogue, mais il reçoit le
 *     contexte vérifié, les documents, et sa sortie est VALIDÉE avant d'être
 *     affichée (voir ../validation). En cas de non-conformité, XAMOTO
 *     retombe automatiquement sur la réponse déterministe.
 *
 * Dans les deux cas : « XAMOTO ne doit jamais inventer une donnée automobile. »
 */
import type { AiCitation, CertaintyLevel, SafetyLevel } from '@xamoto/shared';
import { CERTAINTY_LABELS, MESSAGES, SAFETY_LABELS } from '@xamoto/shared';
import { findDtcKnowledge, MAINTENANCE_BY_KIND, SYMPTOM_BY_KEY, TEST_BY_ID } from '@xamoto/diagnostic';
import type { ContextBuildResult } from './context.js';
import type { RetrievedDocument } from '../rag/index.js';

export const ASSISTANT_INTENTS = [
  'why_mil_on',
  'dtc_meaning',
  'severity',
  'can_i_drive',
  'which_part',
  'what_to_check',
  'which_tests',
  'related_to_previous',
  'verify_repair',
  'why_light_back',
  'maintenance',
  'general_technical',
  'off_topic',
  'greeting',
] as const;
export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export interface AssistantAnswer {
  intent: AssistantIntent;
  contentFr: string;
  contentEn: string;
  citations: AiCitation[];
  usedContext: string[];
  refused: boolean;
  refusalReasonFr?: string;
  refusalReasonEn?: string;
  structured: {
    certainty?: CertaintyLevel;
    safety?: SafetyLevel;
    hypotheses?: Array<{ label: string; certainty: CertaintyLevel; score: number }>;
    tests?: string[];
    nextSteps?: string[];
  };
  engine: 'deterministic' | 'llm';
}

/* ─────────────────────────── Détection d'intention ───────────────────────── */

const INTENT_PATTERNS: Array<{ intent: AssistantIntent; patterns: RegExp[] }> = [
  { intent: 'can_i_drive', patterns: [/\bpuis[- ]je rouler\b/i, /\bje peux rouler\b/i, /\bpeut[- ]on rouler\b/i, /\bcan i drive\b/i, /\bis it safe to drive\b/i, /\brouler avec\b/i, /\bmana ma doxaan\b/i] },
  { intent: 'why_mil_on', patterns: [/\bpourquoi (le )?voyant\b/i, /\bvoyant moteur (est )?allum/i, /\bcheck engine\b/i, /\bmoteur allum/i, /\bwhy is the (check engine )?light on\b/i, /\bpourquoi (le )?temoin\b/i] },
  { intent: 'dtc_meaning', patterns: [/^[PCBU][0-3][0-9A-F]{2}$/i, /\bque signifie\b/i, /\bqu[' ]est[- ]ce que (le code|le defaut|cette erreur)\b/i, /\bsignification du code\b/i, /\bwhat does .* mean\b/i, /\bcode .* veut dire\b/i, /\bexplique.*code\b/i] },
  { intent: 'severity', patterns: [/\best[- ]ce grave\b/i, /\bc[' ]est grave\b/i, /\bgrave ou pas\b/i, /\bdanger/i, /\burgent\b/i, /\bserious\b/i, /\bhow bad\b/i, /\brisque\b/i] },
  { intent: 'which_part', patterns: [/\bquelle pi[eè]ce\b/i, /\bquel composant\b/i, /\bquelle piece\b/i, /\bwhich part\b/i, /\bwhat part\b/i, /\bchang(e|er) (quoi|quelle)\b/i, /\bremplacer quoi\b/i] },
  { intent: 'what_to_check', patterns: [/\bque (dois|devrais)[- ]je v[eé]rifier\b/i, /\bquoi v[eé]rifier\b/i, /\bwhat should i check\b/i, /\bverifier quoi\b/i, /\bquels contr[oô]les\b/i] },
  { intent: 'which_tests', patterns: [/\bquels? tests?\b/i, /\btest.*puis[- ]je faire\b/i, /\bwhat tests\b/i, /\bcomment tester\b/i, /\btest (je|peux)\b/i] },
  { intent: 'related_to_previous', patterns: [/\bli[eé] [aà] mon (pr[eé]c[eé]dent|dernier) diagnostic\b/i, /\bd[eé]j[aà] vu\b/i, /\brelated to my previous\b/i, /\bm[eê]me probl[eè]me\b/i, /\bavant j[' ]avais\b/i] },
  { intent: 'verify_repair', patterns: [/\bj[' ]ai (remplac[eé]|chang[eé]|fait la r[eé]paration)\b/i, /\b(r[eé]paration|reparation) (faite|effectu[eé]e)\b/i, /\bcomment v[eé]rifier\b/i, /\bi (replaced|changed|did the repair)\b/i, /\bhow (do i|can i) verify\b/i] },
  { intent: 'why_light_back', patterns: [/\bpourquoi (le voyant )?(est )?revenu\b/i, /\bil est revenu\b/i, /\bwhy did (it|the light) come back\b/i, /\ble d[eé]faut revient\b/i, /\bvoyant revenu\b/i] },
  { intent: 'maintenance', patterns: [/\bentretien\b/i, /\bvidange\b/i, /\bquand (dois|devrais)[- ]je\b/i, /\bmaintenance\b/i, /\bservice interval\b/i, /\bquand faire\b/i, /\bfiltres?\b/i] },
  { intent: 'greeting', patterns: [/^(bonjour|bonsoir|salut|salam|hello|hi|hey|xamoto)\b/i] },
];

export function detectIntent(question: string): AssistantIntent {
  const q = question.trim();
  for (const entry of INTENT_PATTERNS) {
    if (entry.patterns.some((p) => p.test(q))) return entry.intent;
  }
  // Une question contenant un mot technique relève du domaine automobile.
  if (/\b(moteur|injecteur|sonde|capteur|turbo|filtre|frein|batterie|bo[iî]te|embrayage|vanne|pompe|d[eé]bitm[eè]tre|engine|sensor|brake|clutch|pump)\b/i.test(q)) {
    return 'general_technical';
  }
  return 'off_topic';
}

/* ───────────────────────────── Utilitaires ──────────────────────────────── */

const certaintyFr = (level: CertaintyLevel): string => CERTAINTY_LABELS[level].fr;
const safetyFr = (level: SafetyLevel): string => `${SAFETY_LABELS[level].icon} ${SAFETY_LABELS[level].fr}`;

function citationsFrom(retrieved: RetrievedDocument[]): AiCitation[] {
  return retrieved
    .filter((r) => r.source !== null)
    .map((r) => ({
      documentId: r.document.id,
      sourceId: r.document.sourceId,
      title: r.document.titleFr,
      publisher: r.source?.publisher ?? 'Source interne XAMOTO',
      reliability: r.source?.reliability ?? 'xamoto',
      score: r.score,
      snippet: r.snippet,
    }));
}

function refusalsFrom(pack: ContextBuildResult): { fr: string[]; en: string[] } {
  const fr: string[] = [];
  const en: string[] = [];
  const { pack: p } = pack;
  if (p.dtcs.length === 0 && p.readings.filter((r) => r.supported && r.value !== null).length === 0 && p.symptoms.filter((s) => s.present).length === 0) {
    fr.push(MESSAGES.insufficientDataFr);
    en.push(MESSAGES.insufficientDataEn);
  }
  return { fr, en };
}

/** Bloc « ce que XAMOTO sait / ne sait pas » ajouté à chaque réponse technique. */
function dataDisclosure(contextResult: ContextBuildResult, locale: 'fr' | 'en'): string {
  const { missingFacts } = contextResult;
  if (missingFacts.length === 0) return '';
  const unique = [...new Set(missingFacts)].slice(0, 6);
  return locale === 'fr'
    ? `\n\nDonnées que XAMOTO ne possède pas pour votre véhicule :\n${unique.map((m) => `– ${m}`).join('\n')}`
    : `\n\nData XAMOTO does not have for your vehicle:\n${unique.map((m) => `– ${m}`).join('\n')}`;
}

function sourcesBlock(citations: AiCitation[], locale: 'fr' | 'en'): string {
  if (citations.length === 0) return '';
  return locale === 'fr'
    ? `\n\nSources utilisées :\n${citations.map((c) => `– ${c.title} (${c.publisher}) — fiabilité : ${c.reliability}`).join('\n')}`
    : `\n\nSources used:\n${citations.map((c) => `– ${c.title} (${c.publisher}) — reliability: ${c.reliability}`).join('\n')}`;
}

/* ───────────────────────────── Composition ─────────────────────────────── */

export interface ComposeInput {
  question: string;
  intent: AssistantIntent;
  contextResult: ContextBuildResult;
  retrieved: RetrievedDocument[];
}

export function composeDeterministicAnswer(input: ComposeInput): AssistantAnswer {
  const { intent, contextResult, retrieved, question } = input;
  const { pack } = contextResult;
  const citations = citationsFrom(retrieved);
  const refusals = refusalsFrom(contextResult);
  const hypotheses = pack.hypotheses;
  const top = hypotheses[0];
  const supportedReadings = pack.readings.filter((r) => r.supported && r.value !== null);
  const presentSymptoms = pack.symptoms.filter((s) => s.present);
  const codes = pack.dtcs.map((d) => d.code);

  const structured: AssistantAnswer['structured'] = {
    certainty: pack.session?.certainty ?? undefined,
    safety: pack.session?.safety ?? undefined,
    hypotheses: hypotheses.slice(0, 4).map((h) => ({ label: h.labelFr, certainty: h.certainty, score: h.score })),
    tests: [],
    nextSteps: [],
  };

  const usedContext: string[] = [];
  if (pack.vehicle) usedContext.push('vehicle');
  if (pack.dtcs.length > 0) usedContext.push('dtc');
  if (supportedReadings.length > 0) usedContext.push('readings');
  if (presentSymptoms.length > 0) usedContext.push('symptoms');
  if (hypotheses.length > 0) usedContext.push('diagnostic_engine');
  if (retrieved.length > 0) usedContext.push('knowledge_base');
  if (pack.maintenance.length > 0) usedContext.push('maintenance');
  if (pack.repairs.length > 0) usedContext.push('repairs');

  const base = {
    intent,
    citations,
    usedContext,
    refused: false,
    structured,
    engine: 'deterministic' as const,
  };

  const simNoteFr = pack.mode === 'simulator' ? `\n\n${MESSAGES.simulationFr} — ${MESSAGES.simulationNoticeFr}` : '';
  const simNoteEn = pack.mode === 'simulator' ? `\n\n${MESSAGES.simulationEn} — ${MESSAGES.simulationNoticeEn}` : '';

  switch (intent) {
    /* ── Pourquoi le voyant est allumé ──────────────────────────────────── */
    case 'why_mil_on': {
      if (codes.length === 0) {
        return {
          ...base,
          refused: true,
          refusalReasonFr:
            'Aucun code défaut n’est mémorisé dans le dernier scan de ce véhicule : XAMOTO ne peut pas expliquer pourquoi le voyant serait allumé, car il ne dispose pas de cette donnée.',
          refusalReasonEn:
            'No fault code is stored in the last scan of this vehicle: XAMOTO cannot explain why the light would be on, because it does not have this data.',
          contentFr: `${MESSAGES.insufficientDataFr}\n\nLe dernier scan ne contient aucun code défaut. Un voyant allumé sans code mémorisé arrive lorsque :\n– le défaut a été effacé récemment (le voyant reste allumé un moment),\n– le voyant concerne un système non lu par le scan (ABS, airbag, boîte automatique),\n– le voyant n’est pas allumé en réalité (à confirmer visuellement).\n\nÉtapes utiles : refaire un scan moteur chaud, vérifier le voyant au tableau de bord, et signaler les symptômes observés.${simNoteFr}`,
          contentEn: `${MESSAGES.insufficientDataEn}\n\nThe last scan contains no fault code. An illuminated light without a stored code happens when:\n– the fault was cleared recently (the light stays on for a while),\n– the light concerns a system not read by the scan (ABS, airbag, automatic transmission),\n– the light is not actually on (to be confirmed visually).\n\nUseful steps: rescan with a warm engine, check the dashboard light, and report the observed symptoms.${simNoteEn}`,
        };
      }
      const lines = codes.map((code) => {
        const knowledge = findDtcKnowledge(code);
        return knowledge ? `– ${knowledge.code} : ${knowledge.simpleFr}` : `– ${code} : XAMOTO ne dispose pas de la définition détaillée de ce code pour votre véhicule.`;
      });
      const safetyLine = pack.session?.safety
        ? `\n\nNiveau de sécurité évalué par XAMOTO à partir des données lues : ${safetyFr(pack.session.safety)}.`
        : '';
      return {
        ...base,
        contentFr: `Le voyant moteur s’allume parce que le calculateur a détecté et mémorisé une ou plusieurs anomalies.\n\nCe que le véhicule a signalé lors du dernier scan :\n${lines.join('\n')}${safetyLine}\n\nImportant : le code défaut décrit ce que le calculateur a DÉTECTÉ, pas la pièce responsable. Exemple : « mélange trop pauvre » ne veut pas dire « remplacer le débitmètre ».${dataDisclosure(contextResult, 'fr')}\n\nPour aller plus loin, XAMOTO propose un diagnostic guidé et des tests.${sourcesBlock(citations, 'fr')}${simNoteFr}`,
        contentEn: `The check-engine light is on because the control module detected and stored one or more anomalies.\n\nWhat the vehicle reported in the last scan:\n${codes.map((c) => `– ${c}`).join('\n')}${safetyLine}\n\nImportant: the fault code describes what the ECU DETECTED, not the responsible part. Example: "system too lean" does not mean "replace the MAF sensor".${dataDisclosure(contextResult, 'en')}${sourcesBlock(citations, 'en')}${simNoteEn}`,
      };
    }

    /* ── Signification d'un code ────────────────────────────────────────── */
    case 'dtc_meaning': {
      const codeMatch = /[PCBU][0-3][0-9A-F]{2}/i.exec(question);
      const requestedCode = codeMatch ? codeMatch[0].toUpperCase() : codes[0];
      const knowledge = requestedCode ? findDtcKnowledge(requestedCode) : undefined;
      if (!requestedCode) {
        return { ...base, refused: true, refusalReasonFr: MESSAGES.insufficientDataFr, refusalReasonEn: MESSAGES.insufficientDataEn, contentFr: 'Précisez le code défaut (par exemple P0420) ou effectuez un scan.', contentEn: 'Specify the fault code (for example P0420) or perform a scan.' };
      }
      if (!knowledge) {
        return {
          ...base,
          refused: true,
          refusalReasonFr: `XAMOTO ne dispose pas de cette donnée pour votre véhicule : le code ${requestedCode} n’est pas documenté. Il ne l’inventera pas.`,
          refusalReasonEn: `XAMOTO does not have this data for your vehicle: code ${requestedCode} is not documented. It will not invent one.`,
          contentFr: `Je ne dispose pas de cette donnée pour votre véhicule : le code ${requestedCode} n’est pas documenté dans la base XAMOTO.\n\nUn code défaut se lit ainsi :\n– la lettre indique le système (P = moteur, C = châssis, B = carrosserie, U = réseau),\n– le premier chiffre indique s’il est générique (0) ou propre au constructeur (1).\n\nPour aller plus loin sur ce code, il faut la documentation technique du constructeur pour votre marque et votre moteur. XAMOTO préfère ne rien affirmer plutôt que de vous donner une information non vérifiée.`,
          contentEn: `I do not have this data for your vehicle: code ${requestedCode} is not documented in the XAMOTO database.\n\nA fault code reads as follows:\n– the letter indicates the system (P = powertrain, C = chassis, B = body, U = network),\n– the first digit indicates whether it is generic (0) or manufacturer-specific (1).\n\nTo go further on this code, manufacturer technical documentation for your brand and engine is required. XAMOTO prefers to state nothing rather than give unverified information.`,
        };
      }
      const parts = (top?.parts ?? []).filter(Boolean).map((p) => p.replace(/_/g, ' '));
      const inVehicle = codes.includes(requestedCode);
      const causesList = knowledge.likelyCauses
        .slice(0, 4)
        .map((c) => `– ${c.labelFr}${inVehicle && top?.causeKey === c.key ? ' (hypothèse la plus compatible avec vos données actuelles)' : ''}`);
      return {
        ...base,
        contentFr: `${knowledge.code} — ${knowledge.simpleFr}\n\nSystème concerné : ${knowledge.system}.\nGravité intrinsèque du code : ${safetyFr(knowledge.severity)}.\n${inVehicle ? '\nCe code a réellement été lu sur votre véhicule lors du dernier scan.' : '\nCe code ne figure pas dans le dernier scan de votre véhicule : l’explication porte sur la signification générale du code.'}\n\nCauses possibles (aucune n’est certaine sans test) :\n${causesList.join('\n')}\n\nConséquences si rien n’est fait :\n${knowledge.consequences.map((c) => `– ${c}`).join('\n')}\n\nTests qui permettent de trancher :\n${knowledge.relatedTests.map((t) => `– ${TEST_BY_ID.get(t)?.titleFr ?? t}`).join('\n')}${parts.length > 0 ? `\n\nPièces pouvant être concernées (jamais à remplacer sans test) : ${parts.join(', ')}.` : ''}${dataDisclosure(contextResult, 'fr')}${sourcesBlock(citations, 'fr')}${simNoteFr}`,
        contentEn: `${knowledge.code} — ${knowledge.simpleEn}\n\nAffected system: ${knowledge.system}.\nIntrinsic severity: ${SAFETY_LABELS[knowledge.severity].en}.\n\nPossible causes (none is certain without a test):\n${knowledge.likelyCauses.slice(0, 4).map((c) => `– ${c.labelEn}`).join('\n')}${sourcesBlock(citations, 'en')}${simNoteEn}`,
      };
    }

    /* ── Est-ce grave ? ─────────────────────────────────────────────────── */
    case 'severity': {
      const level = pack.session?.safety;
      if (!level) {
        return { ...base, refused: true, refusalReasonFr: MESSAGES.insufficientDataFr, refusalReasonEn: MESSAGES.insufficientDataEn, contentFr: `${MESSAGES.insufficientDataFr}\n\nEffectuez un scan ou déclarez les symptômes : sans données, XAMOTO ne peut pas qualifier la gravité.`, contentEn: `${MESSAGES.insufficientDataEn}\n\nPerform a scan or declare the symptoms: without data, XAMOTO cannot qualify severity.` };
      }
      const why = pack.session && 'conclusionFr' in pack.session ? String(pack.session.conclusionFr) : '';
      return {
        ...base,
        contentFr: `Évaluation à partir des données lues sur votre véhicule : ${safetyFr(level)}.\n\n${why}\n\nCe que cela signifie concrètement :\n${level === 'critical' ? '– Les données disponibles justifient d’éviter de continuer à rouler.\n– Faites contrôler le véhicule avant de reprendre la route.' : level === 'important' ? '– Un contrôle rapide est recommandé.\n– Évitez les efforts importants et les longs trajets en attendant.' : level === 'attention' ? '– Une surveillance est recommandée ; un contrôle au prochain entretien peut suffire.\n– Consultez plus tôt si les symptômes s’aggravent.' : '– Aucune urgence identifiée dans les données disponibles.\n– Poursuivez l’entretien normal.'}\n\n${MESSAGES.noGuaranteeFr}${dataDisclosure(contextResult, 'fr')}${simNoteFr}`,
        contentEn: `Assessment based on data read from your vehicle: ${SAFETY_LABELS[level].en}.\n\n${MESSAGES.noGuaranteeEn}${simNoteEn}`,
      };
    }

    /* ── Puis-je rouler ? ───────────────────────────────────────────────── */
    case 'can_i_drive': {
      const answer = pack.canIDrive ?? undefined;
      if (!answer || !pack.dtcs.length && supportedReadings.length === 0) {
        return {
          ...base,
          refused: true,
          refusalReasonFr: 'XAMOTO ne peut pas répondre à cette question sans données : aucune mesure ni aucun code défaut n’est disponible pour ce véhicule.',
          refusalReasonEn: 'XAMOTO cannot answer this question without data: no measurement and no fault code are available for this vehicle.',
          contentFr: `XAMOTO ne peut pas répondre « oui » ou « non » sans données.\n\n${MESSAGES.noGuaranteeFr}\n\nRéalisez un scan (contact mis, moteur tournant si possible), ou déclarez les symptômes observés. Si le véhicule présente un voyant de pression d’huile, une pédale de frein molle, une surchauffe, une direction dure ou une odeur de carburant, ne roulez pas et faites appel à un professionnel.`,
          contentEn: `XAMOTO cannot answer "yes" or "no" without data.\n\n${MESSAGES.noGuaranteeEn}`,
        };
      }
      const fr = pack.symptoms.filter((s) => s.present);
      return {
        ...base,
        structured: { ...structured, certainty: answer.certainty, safety: answer.level },
        contentFr: `${safetyFr(answer.level)} — ${answer.headlineFr}\n\nPOURQUOI :\n${answer.whyFr.map((w) => `– ${w}`).join('\n')}\n\nCE QUI DOIT ÊTRE VÉRIFIÉ :\n${answer.toCheckFr.map((w) => `– ${w}`).join('\n')}\n\nCE QU’IL FAUT ÉVITER :\n${answer.avoidFr.map((w) => `– ${w}`).join('\n')}\n\nQUAND CONSULTER :\n${answer.seeProfessionalFr}\n\n${answer.disclaimerFr}\n\nFiabilité de cette réponse selon les données disponibles : ${certaintyFr(answer.certainty)}.${fr.length > 0 ? `\nSymptômes pris en compte : ${fr.map((s) => SYMPTOM_BY_KEY.get(s.key)?.labelFr ?? s.key).join(', ')}.` : ''}${dataDisclosure(contextResult, 'fr')}${simNoteFr}`,
        contentEn: `${SAFETY_LABELS[answer.level].en} — ${answer.headlineEn}\n\nWHY:\n${answer.whyEn.map((w) => `– ${w}`).join('\n')}\n\nWHAT TO CHECK:\n${answer.toCheckEn.map((w) => `– ${w}`).join('\n')}\n\nWHAT TO AVOID:\n${answer.avoidEn.map((w) => `– ${w}`).join('\n')}\n\nWHEN TO SEE A PROFESSIONAL:\n${answer.seeProfessionalEn}\n\n${answer.disclaimerEn}\n\nReliability of this answer given available data: ${answer.certainty.replace(/_/g, ' ')}.${dataDisclosure(contextResult, 'en')}${simNoteEn}`,
      };
    }

    /* ── Quelle pièce ? ─────────────────────────────────────────────────── */
    case 'which_part': {
      if (hypotheses.length === 0) {
        return { ...base, refused: true, refusalReasonFr: MESSAGES.insufficientDataFr, refusalReasonEn: MESSAGES.insufficientDataEn, contentFr: `${MESSAGES.insufficientDataFr}\n\nSans données ni code défaut, XAMOTO ne peut désigner aucune pièce.`, contentEn: `${MESSAGES.insufficientDataEn}\n\nWithout data or fault codes, XAMOTO cannot point to any part.` };
      }
      const withParts = hypotheses.filter((h) => h.parts.length > 0).slice(0, 4);
      const lines = withParts.length > 0
        ? withParts.map((h) => `– ${h.labelFr} → pièce(s) possible(s) : ${h.parts.map((p) => p.replace(/_/g, ' ')).join(', ')} (niveau : ${certaintyFr(h.certainty)})`)
        : ['– Aucune hypothèse actuelle ne permet de désigner une pièce précise avec le niveau de données disponible.'];
      return {
        ...base,
        contentFr: `XAMOTO ne désigne jamais une pièce à remplacer sur la seule base d’un code défaut.\n\nHypothèses actuelles et pièces éventuellement concernées :\n${lines.join('\n')}\n\nRègle appliquée : une pièce ne se remplace qu’après un test qui la désigne. Sans test, le remplacement est un pari — et XAMOTO l’annonce comme tel.\n\nTests utiles avant tout achat :\n${hypotheses.slice(0, 3).map((h) => `– ${h.labelFr} → ${h.discriminatingTests.map((t) => TEST_BY_ID.get(t)?.titleFr ?? t).join(', ') || 'aucun test de confirmation disponible'}`).join('\n')}${dataDisclosure(contextResult, 'fr')}${sourcesBlock(citations, 'fr')}${simNoteFr}`,
        contentEn: `XAMOTO never designates a part to replace based on a fault code alone.\n\nCurrent hypotheses and possibly involved parts:\n${hypotheses.filter((h) => h.parts.length > 0).slice(0, 4).map((h) => `– ${h.labelEn} → ${h.parts.join(', ')} (level: ${h.certainty})`).join('\n')}${sourcesBlock(citations, 'en')}${simNoteEn}`,
      };
    }

    /* ── Que vérifier ? / Quels tests ? ─────────────────────────────────── */
    case 'what_to_check':
    case 'which_tests':
    case 'general_technical': {
      const tests = (pack.tests ?? []).slice(0, 4);
      const testLines = tests
        .map((t) => {
          const definition = TEST_BY_ID.get(t.testKey);
          if (!definition) return null;
          return `– ${definition.titleFr} (sécurité : ${SAFETY_LABELS[definition.safety].fr})\n   Objectif : ${definition.objectiveFr}\n   ${definition.expectedFr ? `Résultat attendu : ${definition.expectedFr}` : 'XAMOTO ne dispose pas de valeur de référence pour ce véhicule : le test reste utile par comparaison.'}`;
        })
        .filter((l): l is string => l !== null);

      const docLines = retrieved.slice(0, 3).map((r) => `– ${r.document.titleFr} : ${r.snippet}`);

      if (testLines.length === 0 && docLines.length === 0) {
        return {
          ...base,
          refused: true,
          refusalReasonFr: 'XAMOTO ne dispose ni de données ni d’élément documentaire pertinent pour répondre à cette question sur votre véhicule.',
          refusalReasonEn: 'XAMOTO has neither data nor relevant documentary element to answer this question about your vehicle.',
          contentFr: `${MESSAGES.insufficientDataFr}\n\nRéalisez un scan ou décrivez précisément le comportement du véhicule (quand cela se produit, à froid ou à chaud, en ville ou sur route, à l’accélération ou au ralenti) : ces informations permettent de choisir le bon test.`,
          contentEn: `${MESSAGES.insufficientDataEn}\n\nPerform a scan or describe precisely how the vehicle behaves (when it happens, cold or warm, city or open road, acceleration or idle): this information allows choosing the right test.`,
        };
      }

      const alsoTests = pack.tests?.map((t) => t.testKey) ?? [];
      structured.tests = alsoTests;
      structured.nextSteps = alsoTests.slice(0, 3);
      return {
        ...base,
        contentFr: `${testLines.length > 0 ? `Vérifications recommandées pour votre véhicule, dans cet ordre :\n${testLines.join('\n')}\n` : ''}${docLines.length > 0 ? `\nÉléments documentaires utiles :\n${docLines.join('\n')}\n` : ''}${hypotheses.length > 0 ? `\nHypothèses à départager : ${hypotheses.slice(0, 4).map((h) => `${h.labelFr} (${certaintyFr(h.certainty)})`).join(' ; ')}.` : ''}${dataDisclosure(contextResult, 'fr')}${sourcesBlock(citations, 'fr')}${simNoteFr}`,
        contentEn: `${testLines.length > 0 ? `Recommended checks for your vehicle, in this order:\n${testLines.join('\n')}\n` : ''}${docLines.length > 0 ? `\nUseful documentation:\n${docLines.join('\n')}\n` : ''}${sourcesBlock(citations, 'en')}${simNoteEn}`,
      };
    }

    /* ── Lien avec le diagnostic précédent ──────────────────────────────── */
    case 'related_to_previous': {
      const hasRepairs = pack.repairs.length > 0;
      const hasHistory = pack.history.length > 0;
      if (!hasRepairs && !hasHistory) {
        return {
          ...base,
          refused: true,
          refusalReasonFr: 'XAMOTO ne dispose pas d’historique pour ce véhicule : aucun diagnostic, aucune réparation enregistrée.',
          refusalReasonEn: 'XAMOTO has no history for this vehicle: no diagnosis, no recorded repair.',
          contentFr: `${MESSAGES.insufficientDataFr}\n\nXAMOTO ne peut pas comparer avec un diagnostic précédent car aucun historique n’est enregistré pour ce véhicule. Les diagnostics et réparations enregistrés dans l’application sont conservés dans le passeport du véhicule et permettent ce type de comparaison.`,
          contentEn: `${MESSAGES.insufficientDataEn}\n\nXAMOTO cannot compare with a previous diagnosis because no history is recorded for this vehicle.`,
        };
      }
      const codes = pack.dtcs.map((d) => d.code);
      const recurring = pack.history.filter((h) => h.type === 'diagnostic' || h.type === 'scan');
      return {
        ...base,
        contentFr: `Historique disponible pour ce véhicule :\n${pack.repairs.slice(0, 5).map((r) => `– Réparation : ${r.description} (${new Date(r.performedAt).toLocaleDateString('fr-FR')})`).join('\n')}${recurring.slice(0, 5).map((h) => `\n– Événement : ${h.titleFr} (${new Date(h.occurredAt).toLocaleDateString('fr-FR')})`).join('')}\n\nCodes actuels : ${codes.join(', ') || 'aucun'}.\n\n${pack.repairs.length > 0 && codes.length > 0 ? 'Un défaut est présent alors qu’une réparation a déjà été enregistrée : cela signifie que la cause réelle n’a pas été traitée, ou qu’une autre cause produit le même code. XAMOTO recommande de faire le test qui permet de trancher AVANT de remplacer à nouveau une pièce.' : 'XAMOTO compare ces éléments sans conclure à un lien de cause à effet sans données supplémentaires.'}${dataDisclosure(contextResult, 'fr')}${simNoteFr}`,
        contentEn: `History available for this vehicle:\n${pack.repairs.map((r) => `– Repair: ${r.description}`).join('\n')}\n\nCurrent codes: ${codes.join(', ') || 'none'}.${simNoteEn}`,
      };
    }

    /* ── J'ai remplacé la pièce : comment vérifier ? ────────────────────── */
    case 'verify_repair': {
      return {
        ...base,
        contentFr: `Pour vérifier une réparation, il faut comparer AVANT et APRÈS — sans quoi il n’y a pas de vérification possible.\n\nMéthode XAMOTO :\n1. Notez les codes et les mesures relevés AVANT l’intervention (XAMOTO les a conservés dans le passeport du véhicule).\n2. Effacez les défauts (sauf s’il s’agit d’un code permanent, qui ne peut pas être effacé).\n3. Roulez réellement : plusieurs trajets, avec montée en température, ralenti, accélération et décélération. Certains défauts (catalyseur, EVAP, FAP, EGR) demandent plusieurs cycles de conduite complets avant de se confirmer.\n4. Refaites un scan moteur chaud.\n5. XAMOTO compare les deux relevés et répond : « problème probablement résolu », « problème toujours présent » ou « données insuffisantes pour confirmer ».\n\nUn défaut effacé ne prouve rien : c’est le scan APRÈS roulage qui compte.${dataDisclosure(contextResult, 'fr')}${sourcesBlock(citations, 'fr')}${simNoteFr}`,
        contentEn: `Verifying a repair requires comparing BEFORE and AFTER — otherwise no verification is possible.\n\nXAMOTO method:\n1. Record codes and measurements BEFORE the work.\n2. Clear faults (unless permanent codes, which cannot be cleared).\n3. Actually drive: several trips with warm-up, idle, acceleration and deceleration.\n4. Rescan with a warm engine.\n5. XAMOTO compares both records and answers: "probably resolved", "still present" or "insufficient data to confirm".${sourcesBlock(citations, 'en')}${simNoteEn}`,
      };
    }

    /* ── Pourquoi le voyant est revenu ? ────────────────────────────────── */
    case 'why_light_back': {
      const codes = pack.dtcs.map((d) => d.code);
      return {
        ...base,
        contentFr: `Un voyant qui revient après effacement n’est pas un défaut fantôme : cela signifie que la condition qui déclenche le défaut s’est reproduite.\n\n${codes.length > 0 ? `Codes actuellement mémorisés : ${codes.join(', ')}.` : 'Aucun code n’est mémorisé dans le dernier scan.'}\n\nLes quatre explications les plus fréquentes :\n– la cause n’a pas été traitée (effacement au lieu d’une réparation),\n– la réparation a traité une conséquence et non la cause,\n– un autre composant produit le même code,\n– le défaut est intermittent (contact, câblage, connecteur oxydé, capteur sensible à la chaleur).\n\nCe que XAMOTO recommande : ne pas effacer à nouveau avant d’avoir réalisé le test qui permet de trancher entre les causes possibles. Chaque effacement détruit une information exploitable.${dataDisclosure(contextResult, 'fr')}${sourcesBlock(citations, 'fr')}${simNoteFr}`,
        contentEn: `A warning light that returns after clearing is not a ghost code: it means the condition that triggers the fault occurred again.\n\nMost frequent explanations:\n– the cause was not addressed (clearing instead of repairing),\n– the repair addressed a consequence rather than the cause,\n– another component produces the same code,\n– the fault is intermittent (contact, wiring, corroded connector, heat-sensitive sensor).${sourcesBlock(citations, 'en')}${simNoteEn}`,
      };
    }

    /* ── Entretien ──────────────────────────────────────────────────────── */
    case 'maintenance': {
      if (pack.maintenance.length === 0) {
        return {
          ...base,
          refused: true,
          refusalReasonFr: 'XAMOTO ne dispose pas du plan d’entretien de ce véhicule : les interventions déjà réalisées ne sont pas renseignées.',
          refusalReasonEn: 'XAMOTO does not have this vehicle maintenance plan: completed services are not recorded.',
          contentFr: `${MESSAGES.insufficientDataFr}\n\nPour calculer une échéance d’entretien, XAMOTO a besoin de la date et du kilométrage de la dernière intervention. Ces informations se trouvent dans le carnet d’entretien du véhicule ou dans les factures. XAMOTO n’invente jamais un intervalle constructeur : il affiche des plages usuelles, attribuées à une source, et vous invite à vérifier le carnet du véhicule.`,
          contentEn: `${MESSAGES.insufficientDataEn}\n\nTo compute a service due date, XAMOTO needs the date and mileage of the last service. XAMOTO never invents a manufacturer interval: it displays usual ranges with an attributed source.`,
        };
      }
      const lines = pack.maintenance.slice(0, 8).map((m) => {
        const definition = MAINTENANCE_BY_KIND.get((m as { kind?: string }).kind ?? '');
        const status = m.status === 'overdue' ? 'EN RETARD' : m.status === 'due_soon' ? 'PROCHAINEMENT' : m.status === 'ok' ? 'à jour' : 'inconnu';
        return `– ${m.labelFr} : ${status}${m.nextDueKm ? ` — échéance ${m.nextDueKm} km` : ''}${m.nextDueAt ? ` (${new Date(m.nextDueAt).toLocaleDateString('fr-FR')})` : ''}${definition ? ` — plage usuelle ${definition.intervalKmRange ? `${definition.intervalKmRange[0]}–${definition.intervalKmRange[1]} km` : `${definition.intervalMonthsRange?.[0]}–${definition.intervalMonthsRange?.[1]} mois`}` : ''}`;
      });
      return {
        ...base,
        contentFr: `Plan d’entretien tel que XAMOTO peut le calculer :\n${lines.join('\n')}\n\nImportant : ces plages sont des intervalles USUELS attribués à une source. Elles ne remplacent pas le carnet d’entretien de votre véhicule, qui seul donne l’intervalle constructeur applicable à votre moteur.\n\nLes facteurs d’usage (poussière, chaleur, embouteillages, trajets courts) réduisent ces intervalles : ce contexte est affiché dans le plan d’entretien XAMOTO.${sourcesBlock(citations, 'fr')}${simNoteFr}`,
        contentEn: `Maintenance plan as computed by XAMOTO:\n${pack.maintenance.slice(0, 8).map((m) => `– ${m.labelEn}: ${m.status}`).join('\n')}\n\nImportant: these ranges are USUAL intervals attributed to a source. They do not replace your vehicle service book.${sourcesBlock(citations, 'en')}${simNoteEn}`,
      };
    }

    /* ── Salutations et hors sujet ──────────────────────────────────────── */
    case 'greeting': {
      const vehicleLabel = pack.vehicle?.brand ? `${pack.vehicle.brand} ${pack.vehicle.model ?? ''}`.trim() : null;
      return {
        ...base,
        contentFr: `Bonjour. Je suis l’assistant XAMOTO.\n\n${vehicleLabel ? `Je peux vous aider sur votre ${vehicleLabel}${pack.dtcs.length > 0 ? ` : ${pack.dtcs.length} défaut(s) sont mémorisés (${codes.join(', ')})` : ' : aucun défaut n’est mémorisé pour le moment'}.` : 'Sélectionnez un véhicule et effectuez un scan pour que je puisse répondre sur des données réelles.'}\n\nVous pouvez me demander par exemple :\n– « Pourquoi le voyant moteur est allumé ? »\n– « Que signifie P0420 ? »\n– « Est-ce que je peux rouler ? »\n– « Que dois-je vérifier ? »\n– « J’ai remplacé la pièce, comment vérifier ? »\n\nJe ne réponds qu’à partir des données de votre véhicule et de la base documentaire XAMOTO : si je ne dispose pas d’une information, je vous le dirai.${simNoteFr}`,
        contentEn: `Hello. I am the XAMOTO assistant.\n\nI can help with your vehicle${pack.dtcs.length > 0 ? `: ${pack.dtcs.length} stored fault(s) (${codes.join(', ')})` : ''}.\n\nYou can ask for example:\n– "Why is the check-engine light on?"\n– "What does P0420 mean?"\n– "Can I drive?"\n– "What should I check?"\n\nI only answer from your vehicle data and the XAMOTO knowledge base: if I do not have an information, I will tell you.${simNoteEn}`,
      };
    }

    default: {
      return {
        ...base,
        refused: true,
        refusalReasonFr: 'Cette question ne relève pas du périmètre de XAMOTO (diagnostic, compréhension et suivi automobile).',
        refusalReasonEn: 'This question is outside the XAMOTO scope (automotive diagnosis, understanding and tracking).',
        contentFr: `Je suis l’assistant XAMOTO : mon domaine est le diagnostic et la compréhension de votre véhicule.\n\nJe ne traiterai pas cette demande, mais je peux répondre sur :\n– l’explication d’un code défaut,\n– la gravité et la sécurité (puis-je rouler ?),\n– les vérifications et les tests à effectuer,\n– les pièces éventuellement concernées,\n– l’entretien et le suivi du véhicule.\n\nPosez votre question dans ce cadre, de préférence après un scan, pour que je puisse m’appuyer sur les données réelles de votre véhicule.`,
        contentEn: `I am the XAMOTO assistant: my scope is vehicle diagnosis and understanding.\n\nI will not handle this request, but I can answer about:\n– explaining a fault code,\n– severity and safety (can I drive?),\n– checks and tests to perform,\n– possibly involved parts,\n– maintenance and vehicle tracking.`,
      };
    }
  }
}
