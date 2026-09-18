/**
 * XAMOTO — Règles fondées sur l'historique (§19, §21, §23).
 *
 * L'historique est ce qui distingue XAMOTO d'un simple lecteur de codes :
 * un défaut qui REVIENT après effacement, une réparation qui n'a pas résolu
 * le problème, un code qui réapparaît à intervalles réguliers.
 */
import { findDtcKnowledge } from '../knowledge/dtc.js';
import type { Rule, RuleEffect } from './types.js';
import { dtcEvidence } from './types.js';

const SOURCE_PRACTICE = 'src_xamoto_practice';

/** Défaut effacé puis revenu : information décisive pour la méthode d'atelier. */
export const ruleDtcReturnedAfterClear: Rule = {
  id: 'rule_dtc_returned',
  domain: 'historique',
  titleFr: 'Défaut revenu après effacement',
  titleEn: 'Fault returned after clearing',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => ctx.dtcs.some((d) => d.returnedAfterClear) || (ctx.history?.returnedCodes?.length ?? 0) > 0,
  apply: (ctx) => {
    const returned = ctx.dtcs.filter((d) => d.returnedAfterClear).map((d) => d.code);
    const fromHistory = ctx.history?.returnedCodes ?? [];
    const codes = [...new Set([...returned, ...fromHistory])];
    const effects: RuleEffect[] = [
      {
        kind: 'finding',
        finding: {
          kind: 'history',
          titleFr: `Défaut(s) revenu(s) après effacement : ${codes.join(', ')}`,
          titleEn: `Fault(s) returned after clearing: ${codes.join(', ')}`,
          detailFr:
            'Un défaut repris après effacement n’est pas un défaut fantôme : il correspond à une condition réellement reproduite par le véhicule. Cela conforte la piste technique, sans désigner la pièce responsable.',
          detailEn:
            'A fault returning after clearing is not a ghost code: it corresponds to a condition genuinely reproduced by the vehicle. This supports the technical lead without pointing to the responsible part.',
          certainty: 'strongly_compatible',
          safety: 'attention',
          evidence: codes.map((c) => dtcEvidence(c, 'Défaut revenu après effacement')),
          origin: 'documented',
        },
      },
      {
        kind: 'note',
        textFr:
          'Méthode recommandée : ne pas effacer à nouveau avant d’avoir effectué le test qui permet de trancher entre les causes possibles. Chaque effacement détruit une information.',
        textEn:
          'Recommended method: do not clear again before performing the test that discriminates between possible causes. Each clear destroys information.',
      },
    ];
    for (const code of codes) {
      const knowledge = findDtcKnowledge(code);
      if (!knowledge) continue;
      for (const cause of knowledge.likelyCauses) {
        effects.push({
          kind: 'cause',
          cause: {
            causeKey: cause.key,
            labelFr: cause.labelFr,
            labelEn: cause.labelEn,
            delta: 0.1,
            weight: 'history',
            reasonFr: `Le défaut ${code} est revenu après effacement : la piste reste ouverte et se renforce légèrement.`,
            reasonEn: `Fault ${code} returned after clearing: the lead remains open and is slightly reinforced.`,
            evidence: [dtcEvidence(code, 'Défaut revenu')],
            confirmedByTest: cause.confirmedBy,
            parts: cause.parts,
          },
        });
      }
    }
    return effects;
  },
};

/** Réparation enregistrée mais défaut toujours présent. */
export const ruleRepairDidNotResolve: Rule = {
  id: 'rule_repair_not_resolved',
  domain: 'historique',
  titleFr: 'Réparation enregistrée sans résolution du défaut',
  titleEn: 'Recorded repair without fault resolution',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => (ctx.history?.repairs?.length ?? 0) > 0 && ctx.dtcs.length > 0,
  apply: (ctx) => {
    const repairs = ctx.history?.repairs ?? [];
    const codes = ctx.dtcs.map((d) => d.code);
    return [
      {
        kind: 'finding',
        finding: {
          kind: 'history',
          titleFr: 'Une réparation a déjà été effectuée et le défaut est toujours présent',
          titleEn: 'A repair has already been performed and the fault is still present',
          detailFr: `Réparation(s) enregistrée(s) : ${repairs.map((r) => r.description).join(' ; ')}. Les codes ${codes.join(', ')} sont toujours présents. Cela signifie que la cause réelle n’a pas été traitée, ou qu’un autre défaut produit les mêmes codes. Il ne faut pas remplacer à nouveau la même pièce sans nouveau test.`,
          detailEn: `Recorded repair(s): ${repairs.map((r) => r.description).join('; ')}. Codes ${codes.join(', ')} are still present. This means the actual cause was not addressed, or another fault produces the same codes. The same part must not be replaced again without a new test.`,
          certainty: 'strongly_compatible',
          safety: 'attention',
          evidence: repairs.map((r) => ({ kind: 'history' as const, ref: r.id, label: r.description, value: r.performedAt })),
          origin: 'documented',
        },
      },
      {
        kind: 'note',
        textFr:
          'Avant toute nouvelle dépense : reprendre le diagnostic à partir des tests recommandés, et vérifier le montage ou la référence de la pièce remplacée si elle est soupçonnée.',
        textEn:
          'Before any further spending: restart the diagnosis from the recommended tests, and check the fitting or reference of the replaced part if it is suspected.',
      },
    ];
  },
};

/** Le même défaut a été vu sur plusieurs scans : récurrence établie. */
export const ruleRecurringAcrossScans: Rule = {
  id: 'rule_recurring_scans',
  domain: 'historique',
  titleFr: 'Défaut récurrent sur plusieurs scans',
  titleEn: 'Fault recurring across several scans',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => {
    const previous = ctx.history?.previousScans ?? [];
    if (previous.length === 0) return false;
    const current = new Set(ctx.dtcs.map((d) => d.code));
    return previous.some((scan) => scan.dtcCodes.some((c) => current.has(c)));
  },
  apply: (ctx) => {
    const previous = ctx.history?.previousScans ?? [];
    const current = ctx.dtcs.map((d) => d.code);
    const recurring = current.filter((code) => previous.filter((scan) => scan.dtcCodes.includes(code)).length >= 2);
    if (recurring.length === 0) return [];
    return [
      {
        kind: 'finding',
        finding: {
          kind: 'history',
          titleFr: `Défaut récurrent : ${recurring.join(', ')} présent sur au moins trois scans`,
          titleEn: `Recurring fault: ${recurring.join(', ')} present on at least three scans`,
          detailFr:
            'Ce défaut se reproduit dans le temps. Une panne récurrente doit être traitée avec la même rigueur qu’une panne permanente : elle reviendra après effacement.',
          detailEn:
            'This fault reproduces over time. A recurring fault must be treated with the same rigour as a permanent one: it will return after clearing.',
          certainty: 'strongly_compatible',
          safety: 'attention',
          evidence: recurring.map((c) => dtcEvidence(c, 'Présent sur plusieurs scans')),
          origin: 'documented',
        },
      },
      {
        kind: 'note',
        textFr:
          'Comparez les conditions d’apparition (moteur froid/chaud, ville/route, climatisation) : un défaut qui apparaît toujours dans les mêmes conditions oriente la recherche.',
        textEn:
          'Compare the conditions of appearance (cold/warm engine, city/open road, air conditioning): a fault that always appears under the same conditions narrows the investigation.',
      },
    ];
  },
};

/** Évolution d'un paramètre dans le temps : base de la maintenance prédictive (§23). */
export const ruleTrendObservation: Rule = {
  id: 'rule_trend',
  domain: 'historique',
  titleFr: 'Évolution d’un paramètre dans le temps',
  titleEn: 'Parameter trend over time',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => {
    const previous = ctx.history?.previousScans ?? [];
    if (previous.length < 2) return false;
    return previous.some((s) => s.keyValues && Object.keys(s.keyValues).length > 0);
  },
  apply: (ctx) => {
    const previous = (ctx.history?.previousScans ?? []).filter((s) => s.keyValues);
    const effects: RuleEffect[] = [];
    for (const reading of ctx.readings) {
      if (reading.value === null || !reading.supported) continue;
      const history = previous
        .map((s) => s.keyValues?.[reading.key])
        .filter((v): v is number => typeof v === 'number');
      if (history.length < 2) continue;
      const first = history[0] as number;
      const last = reading.value as number;
      const delta = last - first;
      const relative = first !== 0 ? Math.abs(delta / first) : 0;
      if (relative < 0.2) continue;
      effects.push({
        kind: 'note',
        textFr: `Évolution de « ${reading.label} » : ${first} → ${last} ${reading.unit} entre les scans précédents et le scan actuel. Il s’agit d’une OBSERVATION de tendance, pas d’une panne : aucune conclusion n’est tirée de cette seule évolution.`,
        textEn: `Trend of "${reading.label}": ${first} → ${last} ${reading.unit} between previous scans and the current scan. This is a TREND OBSERVATION, not a fault: no conclusion is drawn from this trend alone.`,
        level: 'attention',
      });
    }
    return effects;
  },
};

export const HISTORY_RULES: Rule[] = [ruleDtcReturnedAfterClear, ruleRepairDidNotResolve, ruleRecurringAcrossScans, ruleTrendObservation];
