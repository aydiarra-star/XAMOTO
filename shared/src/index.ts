export * from './i18n.js';
export * from './levels.js';
export * from './types.js';

/** §47 — Les principes absolus, exposés au code et à l'interface. */
export const XAMOTO_PRINCIPLES = [
  { id: 1, fr: 'Ne jamais inventer une donnée.', en: 'Never invent automotive data.' },
  { id: 2, fr: 'Ne jamais présenter une simulation comme une donnée réelle.', en: 'Never present simulation data as real.' },
  { id: 3, fr: 'Ne jamais transformer une hypothèse en certitude.', en: 'Never turn a hypothesis into certainty.' },
  { id: 4, fr: 'Toujours indiquer lorsque les données sont insuffisantes.', en: 'Always state when data is insufficient.' },
  { id: 5, fr: 'Toujours privilégier les données mesurées lorsqu’elles existent.', en: 'Always prefer measured data.' },
  { id: 6, fr: 'Séparer diagnostic technique et explication IA.', en: 'Separate technical diagnosis from AI explanation.' },
  { id: 7, fr: 'La sécurité passe avant la commodité.', en: 'Safety before convenience.' },
  { id: 8, fr: 'Chaque conclusion importante doit pouvoir être expliquée.', en: 'Every important conclusion must be explainable.' },
  { id: 9, fr: 'Conserver la provenance des données.', en: 'Keep data provenance.' },
  { id: 10, fr: 'Le système doit pouvoir dire : « je ne sais pas ».', en: 'The system must be able to say "I don’t know".' },
] as const;

export const MESSAGES = {
  insufficientDataFr: 'Je ne dispose pas de cette donnée pour votre véhicule.',
  insufficientDataEn: 'I do not have this data for your vehicle.',
  severalCausesFr: 'Plusieurs causes sont possibles.',
  severalCausesEn: 'Several causes are possible.',
  testRequiredFr: 'Ce test est nécessaire avant de conclure.',
  testRequiredEn: 'This test is required before concluding.',
  simulationFr: 'MODE SIMULATION',
  simulationEn: 'SIMULATION MODE',
  simulationNoticeFr: 'Les données affichées sont simulées et ne proviennent pas d’un véhicule réel.',
  simulationNoticeEn: 'The data shown is simulated and does not come from a real vehicle.',
  noGuaranteeFr:
    'XAMOTO ne peut pas garantir la sécurité de circulation lorsque les données disponibles sont insuffisantes. En cas de doute, faites contrôler le véhicule.',
  noGuaranteeEn:
    'XAMOTO cannot guarantee road safety when available data is insufficient. If in doubt, have the vehicle inspected.',
} as const;
