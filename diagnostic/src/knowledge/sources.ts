/**
 * XAMOTO — Provenance des connaissances (§15, §33).
 *
 * Chaque élément de connaissance référence une source identifiée, avec sa
 * fiabilité. C'est ce qui permet d'auditer une conclusion et d'afficher
 * « d'où vient cette information ».
 */
import type { KnowledgeSource } from '@xamoto/shared';

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  {
    id: 'src_sae_j2012',
    title: 'Norme SAE J2012 — Diagnostic Trouble Code Definitions',
    publisher: 'SAE International',
    reliability: 'official',
    version: 'J2012',
    date: '2016-01-01',
    url: 'https://www.sae.org/standards/content/j2012_201612/',
    licence: 'Norme payante — utilisation des définitions génériques',
  },
  {
    id: 'src_sae_j1979',
    title: 'Norme SAE J1979 — E/E Diagnostic Test Modes (OBD-II / PIDs)',
    publisher: 'SAE International',
    reliability: 'official',
    version: 'J1979',
    date: '2018-01-01',
    url: 'https://www.sae.org/standards/content/j1979_201802/',
    licence: 'Norme payante',
  },
  {
    id: 'src_iso_15031',
    title: 'ISO 15031 — Communication entre véhicule et équipement de diagnostic',
    publisher: 'ISO',
    reliability: 'official',
    version: '15031',
    date: '2015-01-01',
    url: 'https://www.iso.org/standard/66344.html',
  },
  {
    id: 'src_iso_15765',
    title: 'ISO 15765 — Diagnostic sur CAN (DoCAN)',
    publisher: 'ISO',
    reliability: 'official',
    version: '15765',
    date: '2016-01-01',
    url: 'https://www.iso.org/standard/66574.html',
  },
  {
    id: 'src_xamoto_practice',
    title: 'Base de pratique d’atelier XAMOTO',
    publisher: 'XAMOTO',
    reliability: 'xamoto',
    version: '1.0.0',
    date: '2026-01-01',
    licence: 'Documentation du projet XAMOTO',
  },
  {
    id: 'src_maintenance_ranges',
    title: 'Intervalles d’entretien usuels — plages publiées par les constructeurs',
    publisher: 'Synthèse XAMOTO à partir de carnets d’entretien constructeurs',
    reliability: 'technical',
    version: '1.0.0',
    date: '2026-01-01',
    licence:
      'XAMOTO publie des PLAGES, jamais des valeurs constructeur officielles. Le carnet d’entretien du véhicule reste la référence.',
  },
  {
    id: 'src_african_context',
    title: 'Contexte d’usage africain — chaleur, poussière, carburant, trafic urbain',
    publisher: 'XAMOTO (retours terrain Sénégal)',
    reliability: 'xamoto',
    version: '1.0.0',
    date: '2026-01-01',
    licence: 'Documentation du projet XAMOTO',
  },
  {
    id: 'src_iso_14229',
    title: 'ISO 14229-1 — Services de diagnostic unifiés (UDS)',
    publisher: 'ISO',
    reliability: 'official',
    version: '14229-1:2020',
    date: '2020-02-01',
    url: null,
    licence:
      'Norme payante. Sert ici à expliquer une LIMITE : les données hors groupe motopropulseur (freinage, airbag, boîte automatique) passent par des services étendus ou des protocoles constructeur, pas par l’OBD standard.',
  },
  {
    id: 'src_workshop_methods',
    title: 'Méthodes d’atelier usuelles — freinage, réseau CAN, climatisation, transmission, embrayage, suspension',
    publisher: 'Synthèse XAMOTO à partir de méthodes d’atelier publiées',
    reliability: 'technical',
    version: '1.0.0',
    date: '2026-01-01',
    url: null,
    licence:
      'XAMOTO restitue des MÉTHODES, des ORDRES DE VÉRIFICATION et des RÈGLES DE SÉCURITÉ, jamais des valeurs constructeur, des couples de serrage ou des capacités. La documentation du constructeur reste la référence.',
  },
  {
    id: 'src_garage_partner',
    title: 'Données déclarées par les garages partenaires XAMOTO',
    publisher: 'Réseau de garages XAMOTO',
    reliability: 'community',
    version: '1.0.0',
    date: '2026-01-01',
  },
];

export const SOURCE_BY_ID = new Map(KNOWLEDGE_SOURCES.map((s) => [s.id, s]));

export function sourceOf(id: string): KnowledgeSource | null {
  return SOURCE_BY_ID.get(id) ?? null;
}
