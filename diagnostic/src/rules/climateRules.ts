/**
 * XAMOTO — Règles de la climatisation (§15, §16, §39).
 *
 * La climatisation est, avec le freinage, le système le plus souvent « réparé »
 * par rechargement de gaz sans diagnostic. XAMOTO impose l'ordre inverse :
 * propreté du condenseur et du filtre d'habitacle d'abord, pressions ensuite —
 * et rappelle que la manipulation du fluide frigorigène exige un professionnel
 * équipé. En contexte de chaleur et de poussière (§39), ce n'est pas un détail
 * de confort : c'est l'ordre de vérification qui évite une recharge inutile.
 */
import { SYSTEM_COVERAGE } from '../knowledge/systems.js';
import type { Rule, RuleEffect } from './types.js';
import { symptomEvidence } from './types.js';

const SOURCE_AFRICA = 'src_african_context';

export const ruleAcNotCooling: Rule = {
  id: 'rule_ac_not_cooling',
  domain: 'symptome',
  titleFr: 'Climatisation inefficace : vérifier le propre avant le gaz',
  titleEn: 'Ineffective A/C: check cleanliness before refrigerant',
  sourceId: SOURCE_AFRICA,
  systems: ['climatisation'],
  applies: (ctx) => ctx.symptoms.some((s) => s.key === 'ac_not_cold' && s.present),
  apply: (ctx) => {
    const symptom = ctx.symptoms.find((s) => s.key === 'ac_not_cold' && s.present);
    if (!symptom) return [];

    const coverage = SYSTEM_COVERAGE.find((c) => c.system === 'climatisation');
    const hot = ctx.readings.find((r) => r.key === 'ambient_temp' && r.supported && r.value !== null);

    const effects: RuleEffect[] = [
      {
        kind: 'finding',
        finding: {
          kind: 'coherence',
          titleFr: 'La climatisation ne se lit pas par l’OBD standard',
          titleEn: 'Air conditioning cannot be read through standard OBD',
          detailFr:
            'Aucun PID standard ne donne la charge de fluide frigorigène, la pression du circuit ni l’état de l’embrayage du compresseur. XAMOTO ne peut donc afficher aucune mesure de climatisation : il propose un ordre de vérification physique.',
          detailEn:
            'No standard PID reports refrigerant charge, circuit pressure or compressor clutch state. XAMOTO can therefore display no A/C measurement: it offers a physical check order.',
          certainty: 'strongly_compatible',
          safety: 'normal',
          evidence: [symptomEvidence(symptom, 'Climatisation qui ne refroidit plus')],
          origin: 'documented',
        },
      },
      {
        kind: 'cause',
        cause: {
          causeKey: 'ac_filter_dirty',
          labelFr: 'Condenseur obstrué ou filtre d’habitacle colmaté',
          labelEn: 'Blocked condenser or clogged cabin filter',
          delta: 0.35,
          weight: 'documented',
          reasonFr:
            'En saison sèche et en circulation dense, poussière et sable obstruent le condenseur : c’est la cause la plus fréquente, la moins coûteuse, et la seule qui se vérifie sans habilitation.',
          reasonEn:
            'In the dry season and in heavy traffic, dust and sand block the condenser: it is the most frequent and cheapest cause, and the only one checked without certification.',
          confirmedByTest: 'test_ac_visual',
          parts: ['filtre_habitacle'],
        },
      },
      {
        kind: 'cause',
        cause: {
          causeKey: 'ac_gas_low',
          labelFr: 'Charge de fluide insuffisante (fuite)',
          labelEn: 'Insufficient refrigerant charge (leak)',
          delta: 0.3,
          weight: 'documented',
          reasonFr:
            'Une charge insuffisante est fréquente, mais elle ne doit être conclue qu’après un relevé de pressions : recharger sans chercher la fuite revient à payer deux fois.',
          reasonEn:
            'Low charge is frequent, but it should only be concluded after a pressure reading: topping up without finding the leak means paying twice.',
          confirmedByTest: 'test_ac_pressure_pro',
          parts: ['gaz_climatisation'],
        },
      },
      {
        kind: 'test',
        testKey: 'test_ac_visual',
        priority: 6,
        reasonFr: 'Filtre d’habitacle, condenseur, enclenchement du compresseur : gratuit et décisif.',
        reasonEn: 'Cabin filter, condenser, compressor engagement: free and decisive.',
        forCause: 'ac_filter_dirty',
      },
      {
        kind: 'test',
        testKey: 'test_ac_pressure_pro',
        priority: 20,
        reasonFr: 'Relevé des pressions par un professionnel équipé, avec recherche de fuite.',
        reasonEn: 'Pressure reading by an equipped professional, with a leak search.',
        forCause: 'ac_gas_low',
      },
      {
        kind: 'missing',
        itemFr: 'Un relevé daté des pressions de climatisation (basse et haute) par un professionnel équipé',
        itemEn: 'A dated A/C pressure reading (low and high side) by an equipped professional',
        blocksConclusion: true,
      },
      {
        kind: 'certaintyCap',
        level: 'possible',
        reasonFr: 'Sans mesure de pression, la cause d’une climatisation inefficace reste une hypothèse.',
        reasonEn: 'Without pressure measurement, the cause of ineffective A/C remains a hypothesis.',
      },
    ];

    if (hot) {
      effects.push({
        kind: 'note',
        textFr: `Température extérieure mesurée : ${hot.value} °C. Par forte chaleur, un écart de quelques degrés peut venir du seul ensoleillement : comparer avant de conclure à une panne.`,
        textEn: `Measured outside temperature: ${hot.value} °C. In strong heat, a few degrees of difference can come from sunlight alone: compare before concluding a fault.`,
      });
    } else {
      effects.push({
        kind: 'note',
        textFr: 'XAMOTO ne dispose pas de la température extérieure pour ce véhicule : il ne peut pas situer la performance de la climatisation par rapport aux conditions.',
        textEn: 'XAMOTO has no outside temperature for this vehicle: it cannot position A/C performance against conditions.',
      });
    }

    if (coverage) effects.push({ kind: 'note', textFr: coverage.limitsFr, textEn: coverage.limitsEn });

    return effects;
  },
};

export const CLIMATE_RULES: Rule[] = [ruleAcNotCooling];
