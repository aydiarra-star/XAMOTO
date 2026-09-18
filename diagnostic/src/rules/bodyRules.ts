/**
 * XAMOTO — Règles de carrosserie et des organes pyrotechniques (§11, §15, §47).
 *
 * Un circuit d'airbag contient des détonateurs. Aucune fonctionnalité de
 * l'application ne vaut qu'on guide un utilisateur vers une mesure sur ces
 * circuits. La règle ci-dessous ne produit donc AUCUNE hypothèse technique :
 * elle rappelle les règles de sécurité absolues et oriente vers un
 * professionnel équipé.
 */
import { SYSTEM_COVERAGE } from '../knowledge/systems.js';
import type { DiagnosticContext, Rule, RuleEffect } from './types.js';
import { dtcEvidence } from './types.js';

const SOURCE_METHODS = 'src_workshop_methods';

const bodyCodes = (ctx: DiagnosticContext): string[] => ctx.dtcs.map((d) => d.code).filter((code) => code.startsWith('B'));

export const rulePyrotechnicSafety: Rule = {
  id: 'rule_pyrotechnic_safety',
  domain: 'securite',
  titleFr: 'Airbags et prétensionneurs : XAMOTO ne guide pas ces vérifications',
  titleEn: 'Airbags and pretensioners: XAMOTO does not guide these checks',
  sourceId: SOURCE_METHODS,
  systems: ['airbag', 'carrosserie'],
  applies: (ctx) => bodyCodes(ctx).length > 0,
  apply: (ctx) => {
    const codes = bodyCodes(ctx);
    const safety = SYSTEM_COVERAGE.find((c) => c.system === 'airbag');

    const effects: RuleEffect[] = [
      {
        kind: 'safety',
        level: 'important',
        reasonFr:
          'Un défaut de carrosserie signalé peut concerner un circuit d’airbag. Un voyant d’airbag allumé signifie que le système peut ne pas se déclencher : ce n’est pas un défaut à différer, mais il ne se diagnostique pas à domicile.',
        reasonEn:
          'A reported body fault may involve an airbag circuit. An airbag warning light means the system may not deploy: this is not a fault to postpone, but it is not diagnosed at home either.',
        evidence: codes.map((code) => dtcEvidence(code, 'Défaut de carrosserie')),
      },
      {
        kind: 'finding',
        finding: {
          kind: 'coherence',
          titleFr: 'Aucune hypothèse technique ne sera proposée sur ce système',
          titleEn: 'No technical hypothesis will be offered on this system',
          detailFr:
            'Règles de sécurité absolues : ne jamais mesurer un circuit de déclencheur (déployeur) avec un ohmmètre ; couper le contact et respecter le délai de décharge des condensateurs indiqué par le constructeur avant toute intervention ; ne jamais travailler sur un circuit sous tension ; ne pas laisser un connecteur d’airbag débranché contact mis. Le contrôle doit être fait par un professionnel équipé de l’outil constructeur.',
          detailEn:
            'Absolute safety rules: never measure a deployer circuit with an ohmmeter; switch off the ignition and respect the manufacturer capacitor discharge delay before any work; never work on a live circuit; do not leave an airbag connector unplugged with the ignition on. The check must be done by a professional with the manufacturer tool.',
          certainty: 'undeterminable',
          safety: 'important',
          evidence: codes.map((code) => dtcEvidence(code, 'Défaut de carrosserie')),
          origin: 'documented',
        },
      },
      {
        kind: 'missing',
        itemFr: 'Un diagnostic par un professionnel équipé de l’outil constructeur (airbag et prétensionneurs)',
        itemEn: 'A diagnosis by a professional with the manufacturer tool (airbags and pretensioners)',
        blocksConclusion: true,
      },
      {
        kind: 'certaintyCap',
        level: 'undeterminable',
        reasonFr: 'Ces systèmes ne sont pas lisibles par l’OBD standard, et leur vérification est réservée à un professionnel.',
        reasonEn: 'These systems are not readable through standard OBD, and their check is reserved for a professional.',
      },
    ];

    if (safety) effects.push({ kind: 'note', textFr: safety.limitsFr, textEn: safety.limitsEn });

    return effects;
  },
};

export const BODY_RULES: Rule[] = [rulePyrotechnicSafety];
