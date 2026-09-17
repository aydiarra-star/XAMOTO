/**
 * XAMOTO — Package diagnostic.
 *
 * Contient, conformément à la structure du projet (§48) :
 *   diagnostic/engine   : moteur de diagnostic déterministe
 *   diagnostic/rules    : règles techniques
 *   diagnostic/dtc      : base de connaissances des codes défaut
 *   diagnostic/tests    : tests guidés
 *   diagnostic/safety   : moteur de sécurité + « Puis-je rouler ? »
 */
export { DiagnosticEngine, diagnosticEngine, ENGINE_VERSION, testResultEffects } from './engine/index.js';
export type { DiagnosticResult, DiagnosticNote, AnalyzeOptions } from './engine/index.js';
export { buildHypotheses, composeConclusion } from './engine/hypotheses.js';
export { buildGuidedSession, relevantSymptoms } from './engine/guided.js';
export type { GuidedSession, GuidedStep, GuidedStepKind } from './engine/guided.js';
export { compareAfterRepair } from './engine/postRepair.js';
export type { ScanSummary, RepairComparisonInput } from './engine/postRepair.js';
export { secondOpinion } from './engine/secondOpinion.js';
export type { SecondOpinionInput, SecondOpinionResult } from './engine/secondOpinion.js';
export { buildInspectionReport } from './engine/inspection.js';
export type { InspectionOptions } from './engine/inspection.js';
export { buildMaintenancePlan } from './engine/maintenance.js';
export type { MaintenancePlanInput, PlannedItem } from './engine/maintenance.js';

export { assessSafety } from './safety/index.js';
export type { SafetyAssessment, SafetyReason } from './safety/index.js';
export { canIDrive, canIDriveFromDtcSeverity } from './safety/canIDrive.js';
export type { CanIDriveAnswer } from './safety/canIDrive.js';

export { ALL_RULES, RULES_BY_ID, RULES_BY_DOMAIN, ENGINE_RULES_VERSION, DTC_RULES, PID_RULES, SYMPTOM_RULES, HISTORY_RULES, COHERENCE_RULES } from './rules/index.js';
export type { Rule, RuleEffect, CauseEffect, DiagnosticContext, ReadingInput, DtcInput, HistoryInput } from './rules/types.js';
export { pidEvidence, dtcEvidence, symptomEvidence, systemsFromCodes } from './rules/types.js';

export {
  ALL_DTC_KNOWLEDGE,
  ENGINE_DTCS,
  COOLING_DTCS,
  EMISSION_DTCS,
  ELECTRICAL_DTCS,
  INTAKE_DTCS,
  NETWORK_DTCS,
  findDtcKnowledge,
  describeUnknownDtc,
} from './knowledge/dtc.js';
export type { DtcKnowledge } from './knowledge/dtc.js';
export { GUIDED_TESTS, TEST_BY_ID, getTests, FALLBACK_TESTS } from './knowledge/tests.js';
export { SYMPTOM_DEFINITIONS, SYMPTOM_BY_KEY, SYMPTOM_HYPOTHESES, symptomHypothesesFor } from './knowledge/symptoms.js';
export type { SymptomHypothesisSeed } from './knowledge/symptoms.js';
export { MAINTENANCE_DEFINITIONS, MAINTENANCE_BY_KIND } from './knowledge/maintenance.js';
export type { MaintenanceDefinition } from './knowledge/maintenance.js';
export { KNOWLEDGE_SOURCES, SOURCE_BY_ID, sourceOf } from './knowledge/sources.js';
