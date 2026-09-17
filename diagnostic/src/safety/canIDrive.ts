/**
 * XAMOTO — « Puis-je rouler ? » (§12).
 *
 * Réponse structurée, toujours composée des mêmes rubriques :
 *   Niveau de risque · Pourquoi ? · Ce qui doit être vérifié ·
 *   Ce qu'il faut éviter · Quand consulter un professionnel.
 *
 * Contraintes produit :
 *  – XAMOTO ne donne JAMAIS de garantie ;
 *  – une réponse « oui » n'est jamais plus forte que la qualité des données ;
 *  – dès qu'un signe critique existe, la réponse est « non » même sans certitude
 *    sur la cause.
 */
import type { CertaintyLevel, EvidenceRef, SafetyLevel, SymptomKey } from '@xamoto/shared';
import { CERTAINTY_LABELS, MESSAGES, SAFETY_LABELS, worstSafety } from '@xamoto/shared';
import { SYMPTOM_BY_KEY } from '../knowledge/symptoms.js';
import { TEST_BY_ID } from '../knowledge/tests.js';
import type { DiagnosticContext } from '../rules/types.js';
import type { SafetyAssessment } from './index.js';

export interface CanIDriveAnswer {
  /** Niveau de risque — le même vocabulaire que partout dans XAMOTO. */
  level: SafetyLevel;
  /** Réponse courte, prudente, en une phrase. */
  headlineFr: string;
  headlineEn: string;
  whyFr: string[];
  whyEn: string[];
  toCheckFr: string[];
  toCheckEn: string[];
  avoidFr: string[];
  avoidEn: string[];
  seeProfessionalFr: string;
  seeProfessionalEn: string;
  /** Fiabilité de la réponse elle-même (jamais celle du véhicule). */
  certainty: CertaintyLevel;
  disclaimerFr: string;
  disclaimerEn: string;
  dataUsed: EvidenceRef[];
  missingData: string[];
}

type Advice = { fr: string; en: string };

/** Conseils « éviter », choisis en fonction de ce qui est réellement constaté. */
function avoidAdvice(ctx: DiagnosticContext, assessment: SafetyAssessment): Advice[] {
  const advice: Advice[] = [];
  const codes = ctx.dtcs.map((d) => d.code);
  const symptoms = new Set<SymptomKey>(ctx.symptoms.filter((s) => s.present).map((s) => s.key));
  const reading = (key: string) => ctx.readings.find((r) => r.key === key && r.supported && r.value !== null)?.value ?? null;

  const hasOverheat = symptoms.has('overheating') || symptoms.has('coolant_loss') || (reading('coolant_temp') ?? 0) >= 105;
  const hasMisfire = codes.some((c) => /^P030/.test(c)) || symptoms.has('warning_light_flashing') || symptoms.has('jerking');
  const hasCharging = codes.some((c) => c.startsWith('P056')) || symptoms.has('battery_light_on');
  const hasFuel = symptoms.has('smell_fuel') || codes.some((c) => /^P04(4|5)/.test(c));
  const hasBrakes = symptoms.has('brake_soft_pedal') || symptoms.has('brake_noise') || codes.some((c) => c.startsWith('C0'));
  const hasLimp = symptoms.has('limp_mode');

  if (hasOverheat) {
    advice.push(
      { fr: 'Ne pas ouvrir le bouchon du vase d’expansion moteur chaud : risque de brûlure grave.', en: 'Do not open the expansion tank cap while the engine is hot: risk of severe burns.' },
      { fr: 'Éviter les embouteillages, les arrêts moteur tournant et les montées soutenues tant que la cause n’est pas identifiée.', en: 'Avoid traffic jams, idling stops and sustained climbs until the cause is identified.' },
      { fr: 'Mettre le chauffage à fond en cas de montée en température : cela évacue une partie de la chaleur.', en: 'Turn the heating to maximum if temperature rises: it evacuates part of the heat.' },
    );
  }
  if (hasMisfire) {
    advice.push(
      { fr: 'Éviter les fortes accélérations et les charges lourdes : un raté d’allumage peut endommager le catalyseur.', en: 'Avoid hard acceleration and heavy loads: a misfire can damage the catalytic converter.' },
      { fr: 'Ne pas effacer le code défaut avant d’avoir réalisé le diagnostic : l’effacement détruit la preuve.', en: 'Do not clear the fault code before diagnosis: clearing destroys the evidence.' },
    );
  }
  if (hasCharging) {
    advice.push(
      { fr: 'Éviter les trajets courts répétés et les usages électriques inutiles (la batterie se décharge).', en: 'Avoid repeated short trips and unnecessary electrical use (the battery discharges).' },
      { fr: 'Ne pas couper le moteur dans un endroit où le redémarrage serait impossible ou dangereux.', en: 'Do not switch off the engine where restarting would be impossible or dangerous.' },
    );
  }
  if (hasFuel) {
    advice.push(
      { fr: 'Ne pas fumer ni approcher une flamme du véhicule : une odeur de carburant signale un risque d’incendie.', en: 'Do not smoke or bring a flame near the vehicle: fuel smell indicates a fire risk.' },
    );
  }
  if (hasBrakes) {
    advice.push(
      { fr: 'Éviter de rouler si la pédale de frein est molle, si la course est anormalement longue ou si le véhicule tire d’un côté au freinage.', en: 'Avoid driving if the brake pedal is soft, the travel is unusually long or the vehicle pulls to one side when braking.' },
    );
  }
  if (hasLimp) {
    advice.push(
      { fr: 'Éviter l’autoroute et les dépassements : le mode dégradé peut limiter la puissance sans prévenir.', en: 'Avoid motorways and overtaking: limp mode can limit power without warning.' },
    );
  }

  if (assessment.cannotGuarantee) {
    advice.push({
      fr: 'Privilégier les trajets indispensables tant que les données manquent : XAMOTO ne peut pas garantir la sécurité ici.',
      en: 'Limit yourself to essential trips while data is missing: XAMOTO cannot guarantee safety here.',
    });
  }

  if (advice.length === 0) {
    advice.push({
      fr: 'Rien d’anormal n’a été identifié dans les données disponibles. Cela ne remplace pas un contrôle visuel régulier (freins, pneus, niveaux).',
      en: 'Nothing abnormal was identified in the available data. This does not replace regular visual checks (brakes, tyres, levels).',
    });
  }
  return advice;
}

function headline(level: SafetyLevel): { fr: string; en: string } {
  switch (level) {
    case 'critical':
      return {
        fr: 'Il est déconseillé de continuer à rouler. Un contrôle s’impose avant de reprendre la route.',
        en: 'Continuing to drive is not advised. A check is required before driving on.',
      };
    case 'important':
      return {
        fr: 'Roulez uniquement si c’est nécessaire : trajets courts, à allure modérée, et faites contrôler le véhicule rapidement.',
        en: 'Drive only if necessary: short trips, moderate speed, and have the vehicle checked promptly.',
      };
    case 'attention':
      return {
        fr: 'Vous pouvez rouler en surveillant le comportement du véhicule. Un contrôle est recommandé prochainement.',
        en: 'You can drive while monitoring the vehicle behaviour. A check is recommended soon.',
      };
    default:
      return {
        fr: 'Aucune contre-indication n’a été identifiée à partir des données disponibles. La conduite reste possible, avec l’entretien normal du véhicule.',
        en: 'No contra-indication was identified from the available data. Driving remains possible, with normal vehicle maintenance.',
      };
  }
}

function seeProfessional(level: SafetyLevel, ctx: DiagnosticContext): { fr: string; en: string } {
  const symptoms = new Set(ctx.symptoms.filter((s) => s.present).map((s) => s.key));
  if (level === 'critical') {
    return {
      fr: 'Maintenant, ou dès que possible sans prendre de risque sur la route. Si un voyant de pression d’huile, une pédale de frein molle ou une surchauffe persiste, faites remorquer le véhicule plutôt que de rouler.',
      en: 'Now, or as soon as possible without taking road risks. If an oil pressure light, soft brake pedal or overheating persists, have the vehicle towed rather than driven.',
    };
  }
  if (symptoms.has('brake_noise') || symptoms.has('brake_soft_pedal')) {
    return {
      fr: 'Rapidement : tout doute sur le freinage doit être vérifié par un professionnel avant un trajet important.',
      en: 'Promptly: any doubt about braking must be checked by a professional before a significant trip.',
    };
  }
  if (level === 'important') {
    return {
      fr: 'Dans les jours qui viennent, et immédiatement si un voyant se met à clignoter, si le moteur cale ou si une fumée anormale apparaît.',
      en: 'In the coming days, and immediately if a light starts flashing, the engine stalls or abnormal smoke appears.',
    };
  }
  if (level === 'attention') {
    return {
      fr: 'Lors du prochain entretien, ou plus tôt si les symptômes s’aggravent ou si le voyant s’allume fixement.',
      en: 'At the next service, or sooner if symptoms worsen or the light stays on.',
    };
  }
  return {
    fr: 'En cas d’apparition de bruit, fumée, voyant ou perte de puissance. Conservez le contrôle visuel et les niveaux comme d’habitude.',
    en: 'If noise, smoke, warning light or power loss appear. Keep up routine visual checks and fluid levels.',
  };
}

export function canIDriveFromDtcSeverity(codes: string[]): SafetyLevel {
  const levels = codes.map((code) => (/^(C0|U01)/.test(code) ? 'important' : 'attention') as SafetyLevel);
  return levels.length > 0 ? worstSafety(levels) : 'normal';
}

/**
 * Compose la réponse « Puis-je rouler ? ».
 * `assessment` vient du moteur de sécurité : cette fonction ne peut que
 * RESTITUER ou RENFORCER le niveau, jamais l'atténuer.
 */
export function canIDrive(ctx: DiagnosticContext, assessment: SafetyAssessment): CanIDriveAnswer {
  const level = assessment.level;
  const headlineText = headline(level);

  const whyFr = assessment.reasons.filter((r) => r.level === level || level === 'normal').map((r) => r.fr).slice(0, 6);
  const whyEn = assessment.reasons.filter((r) => r.level === level || level === 'normal').map((r) => r.en).slice(0, 6);

  if (whyFr.length === 0) {
    whyFr.push(
      ctx.dtcs.length === 0
        ? 'Aucun code défaut n’a été mémorisé au moment de la lecture.'
        : 'Les éléments disponibles n’ont pas permis d’identifier une cause dominante.',
    );
    whyEn.push(
      ctx.dtcs.length === 0
        ? 'No fault code was stored at the time of reading.'
        : 'Available elements did not allow identifying a dominant cause.',
    );
  }

  /* Ce qui doit être vérifié : les tests du moteur, jamais des suppositions. */
  const tests = ctx.testResults ?? [];
  const alreadyDone = new Set(tests.map((t) => t.testKey));
  const testsToRun = (ctx as { proposedTests?: string[] }).proposedTests ?? [];
  const toCheckFr: string[] = [];
  const toCheckEn: string[] = [];
  const checked: string[] = [];

  for (const symptom of ctx.symptoms.filter((s) => s.present)) {
    const definition = SYMPTOM_BY_KEY.get(symptom.key);
    if (!definition) continue;
    checked.push(definition.labelFr);
  }

  if (checked.length > 0) {
    toCheckFr.push(`Vérifier en priorité les symptômes signalés : ${checked.join(', ')}.`);
    toCheckEn.push('Check the reported symptoms first.');
  }

  const candidateTests = testsToRun.length > 0 ? testsToRun : [];
  for (const testKey of candidateTests) {
    if (alreadyDone.has(testKey)) continue;
    const definition = TEST_BY_ID.get(testKey);
    if (!definition) continue;
    toCheckFr.push(`${definition.titleFr} — ${definition.objectiveFr}`);
    toCheckEn.push(`${definition.titleEn} — ${definition.objectiveEn}`);
    if (toCheckFr.length >= 4) break;
  }

  if (toCheckFr.length === 0 && level !== 'normal') {
    const genericAdvice: Advice[] = [
      { fr: 'Faire lire les codes défaut et vérifier les valeurs en direct (tension batterie, température moteur) avant tout remplacement de pièce.', en: 'Read fault codes and check live values (battery voltage, engine temperature) before replacing any part.' },
      { fr: 'Ne remplacer aucune pièce sans un test qui la désigne : une pièce remplacée à l’aveugle n’apporte aucune preuve.', en: 'Do not replace any part without a test pointing to it: a blind replacement provides no proof.' },
    ];
    toCheckFr.push(...genericAdvice.map((a) => a.fr));
    toCheckEn.push(...genericAdvice.map((a) => a.en));
  }
  if (toCheckFr.length === 0) {
    toCheckFr.push('Poursuivre le contrôle visuel régulier (freins, pneus, niveaux) et refaire une lecture des codes défaut au prochain entretien.');
    toCheckEn.push('Continue regular visual checks (brakes, tyres, levels) and read fault codes again at the next service.');
  }

  const advice = avoidAdvice(ctx, assessment);
  const professional = seeProfessional(level, ctx);

  const dataUsed: EvidenceRef[] = [
    ...ctx.dtcs.map((d) => ({ kind: 'dtc' as const, ref: d.code, label: `Code défaut ${d.code}`, value: d.status })),
    ...ctx.readings
      .filter((r) => r.supported && r.value !== null)
      .slice(0, 12)
      .map((r) => ({ kind: 'pid' as const, ref: r.key, label: r.label, value: `${r.value} ${r.unit}` })),
    ...ctx.symptoms.filter((s) => s.present).map((s) => ({ kind: 'symptom' as const, ref: s.key, label: SYMPTOM_BY_KEY.get(s.key)?.labelFr ?? s.key })),
  ];

  const missingData = [
    ...assessment.dataQuality.notes,
    ...(assessment.dataQuality.supportedReadings === 0 ? ['Aucune mesure en direct disponible.'] : []),
    ...(ctx.source === 'none' ? ['Aucun scan OBD réalisé.'] : []),
  ];

  return {
    level,
    headlineFr: headlineText.fr,
    headlineEn: headlineText.en,
    whyFr,
    whyEn,
    toCheckFr,
    toCheckEn,
    avoidFr: advice.map((a) => a.fr),
    avoidEn: advice.map((a) => a.en),
    seeProfessionalFr: professional.fr,
    seeProfessionalEn: professional.en,
    certainty: assessment.dataQuality.certainty,
    disclaimerFr: `${MESSAGES.noGuaranteeFr} Réponse établie à partir des données lues au moment du scan (fiabilité : ${CERTAINTY_LABELS[assessment.dataQuality.certainty].fr.toLowerCase()}). Un état peut évoluer entre deux scans.`,
    disclaimerEn: `${MESSAGES.noGuaranteeEn} Answer based on data read at scan time (reliability: ${CERTAINTY_LABELS[assessment.dataQuality.certainty].en.toLowerCase()}). A condition can change between two scans.`,
    dataUsed,
    missingData,
  };
}
