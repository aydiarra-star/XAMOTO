/**
 * XAMOTO — Règles du système de freinage (§11, §15, §16).
 *
 * Le freinage n'est pas lisible par l'OBD standard : XAMOTO ne peut donc jamais
 * confirmer une cause sur ce système à partir d'un scan. Ces règles servent à
 * deux choses, et à deux seulement :
 *
 *   1. empêcher une conclusion abusive (un code de capteur de roue ne désigne
 *      pas un calculateur ABS à remplacer) ;
 *   2. imposer l'ordre de vérification réel — roue, câblage, masse, puis
 *      seulement ensuite l'hydraulique et les boîtiers — et hisser le niveau de
 *      sécurité quand la pédale ou le comportement l'exigent.
 */
import type { SafetyLevel } from '@xamoto/shared';
import { worstSafety } from '@xamoto/shared';
import { findDtcKnowledge } from '../knowledge/dtc.js';
import { SYSTEM_COVERAGE } from '../knowledge/systems.js';
import type { DiagnosticContext, Rule, RuleEffect } from './types.js';
import { dtcEvidence, symptomEvidence } from './types.js';

const SOURCE_METHODS = 'src_workshop_methods';

const chassisCodes = (ctx: DiagnosticContext): string[] => ctx.dtcs.map((d) => d.code).filter((code) => code.startsWith('C'));

const coverage = SYSTEM_COVERAGE.find((c) => c.system === 'freinage');

/**
 * Un code de châssis (C0xxx) décrit un CIRCUIT, pas une pièce à changer.
 * XAMOTO rappelle l'ordre de vérification et plafonne la certitude.
 */
export const ruleChassisCodeDiscipline: Rule = {
  id: 'rule_chassis_code_discipline',
  domain: 'dtc',
  titleFr: 'Code de châssis : circuit d’abord, pièce ensuite',
  titleEn: 'Chassis code: circuit first, part later',
  sourceId: SOURCE_METHODS,
  systems: ['freinage', 'abs'],
  applies: (ctx) => chassisCodes(ctx).length > 0,
  apply: (ctx) => {
    const codes = chassisCodes(ctx);
    const effects: RuleEffect[] = [];

    const severities = codes.map((code) => findDtcKnowledge(code)?.severity ?? 'attention') as SafetyLevel[];
    const safety = worstSafety(severities);

    effects.push({
      kind: 'finding',
      finding: {
        kind: 'coherence',
        titleFr: 'Un code de châssis désigne un circuit, jamais une pièce à remplacer',
        titleEn: 'A chassis code points to a circuit, never to a part to replace',
        detailFr:
          'Ces codes proviennent du calculateur de freinage : ils décrivent un signal absent, incohérent ou hors plage. Les causes les plus fréquentes sont côté roue (capteur, cible magnétique sale, limaille) et côté câblage (connecteur oxydé, fil coupé, masse défectueuse) — pas dans le boîtier. XAMOTO ne conclura donc jamais « calculateur ABS à remplacer » à partir de ces seuls codes.',
        detailEn:
          'These codes come from the braking module: they describe a missing, inconsistent or out-of-range signal. The most frequent causes are at the wheel (sensor, dirty magnetic target, metal debris) and in the wiring (corroded connector, broken wire, faulty ground) — not inside the module. XAMOTO will therefore never conclude “replace the ABS module” from these codes alone.',
        certainty: 'strongly_compatible',
        safety,
        evidence: codes.map((code) => dtcEvidence(code, findDtcKnowledge(code)?.simpleFr ?? 'Code de châssis')),
        origin: 'documented',
      },
    });

    effects.push({
      kind: 'test',
      testKey: 'test_wheel_sensor_signal',
      priority: 10,
      reasonFr: 'Comparer les quatre vitesses de roue situe le circuit concerné sans rien démonter.',
      reasonEn: 'Comparing the four wheel speeds locates the affected circuit without dismantling anything.',
      forCause: 'wheel_sensor_faulty',
    });
    effects.push({
      kind: 'test',
      testKey: 'test_brake_visual',
      priority: 25,
      reasonFr: 'Le contrôle visuel couvre ce que l’OBD ne voit pas : plaquettes, disques, liquide, fuites.',
      reasonEn: 'The visual check covers what OBD cannot see: pads, discs, fluid, leaks.',
      forCause: 'brake_pads_worn',
    });

    effects.push({
      kind: 'missing',
      itemFr: 'Un contrôle visuel du freinage (plaquettes, disques, liquide) et l’état des masses et connecteurs près des roues',
      itemEn: 'A visual braking check (pads, discs, fluid) and the condition of grounds and connectors near the wheels',
      blocksConclusion: true,
    });

    if (coverage) {
      effects.push({ kind: 'note', textFr: coverage.limitsFr, textEn: coverage.limitsEn });
    }

    effects.push({
      kind: 'certaintyCap',
      level: 'possible',
      reasonFr: 'Un code de châssis ne peut pas être confirmé par l’OBD standard : seule une mesure physique le confirme.',
      reasonEn: 'A chassis code cannot be confirmed through standard OBD: only a physical measurement confirms it.',
    });

    return effects;
  },
};

/**
 * Pédale de frein molle : c'est une urgence, indépendamment de tout code.
 * La règle ne propose aucune conclusion technique — elle impose l'arrêt et le
 * contrôle par un professionnel.
 */
export const ruleSoftBrakePedal: Rule = {
  id: 'rule_soft_brake_pedal',
  domain: 'securite',
  titleFr: 'Pédale de frein molle : danger immédiat',
  titleEn: 'Soft brake pedal: immediate danger',
  sourceId: SOURCE_METHODS,
  systems: ['freinage'],
  applies: (ctx) => ctx.symptoms.some((s) => s.key === 'brake_soft_pedal' && s.present),
  apply: (ctx) => {
    const symptom = ctx.symptoms.find((s) => s.key === 'brake_soft_pedal' && s.present);
    if (!symptom) return [];

    const effects: RuleEffect[] = [
      {
        kind: 'safety',
        level: 'critical',
        reasonFr:
          'Une pédale de frein molle ou qui s’enfonce signale une perte de pression dans le circuit hydraulique (fuite ou air). Ce n’est pas un défaut à surveiller : le véhicule ne doit pas rouler avant contrôle.',
        reasonEn:
          'A soft or sinking brake pedal indicates a pressure loss in the hydraulic circuit (leak or air). This is not a fault to monitor: the vehicle must not be driven before a check.',
        evidence: [symptomEvidence(symptom, 'Pédale de frein molle')],
      },
      {
        kind: 'finding',
        finding: {
          kind: 'coherence',
          titleFr: 'Le circuit hydraulique de freinage ne se lit pas par l’OBD',
          titleEn: 'The brake hydraulic circuit cannot be read through OBD',
          detailFr:
            'Aucune mesure OBD ne renseigne la pression hydraulique, le niveau réel de liquide ou la présence d’air dans le circuit. XAMOTO ne propose donc aucune hypothèse chiffrée ici : il exige un contrôle physique.',
          detailEn:
            'No OBD measurement reports hydraulic pressure, actual fluid level or air in the circuit. XAMOTO therefore offers no scored hypothesis here: it requires a physical check.',
          certainty: 'undeterminable',
          safety: 'critical',
          evidence: [symptomEvidence(symptom, 'Pédale de frein molle')],
          origin: 'documented',
        },
      },
      {
        kind: 'test',
        testKey: 'test_brake_visual',
        priority: 5,
        reasonFr: 'Vérifier le niveau de liquide et l’absence de fuite avant tout déplacement du véhicule.',
        reasonEn: 'Check fluid level and absence of leaks before moving the vehicle.',
      },
      {
        kind: 'missing',
        itemFr: 'Un contrôle du circuit hydraulique par un professionnel (purge, recherche de fuite) avant de rouler',
        itemEn: 'A professional check of the hydraulic circuit (bleeding, leak search) before driving',
        blocksConclusion: true,
      },
    ];

    return effects;
  },
};

export const BRAKING_RULES: Rule[] = [ruleChassisCodeDiscipline, ruleSoftBrakePedal];
