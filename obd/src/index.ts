/**
 * XAMOTO — Couche OBD.
 *
 * Architecture (§7) : l'application ne parle JAMAIS directement à un
 * adaptateur. Tout passe par cette couche :
 *
 *   Application → ObdAdapter → protocol (ELM327 / CAN) → moteur de données
 *
 * Ajouter un adaptateur = implémenter `ObdAdapter` et l'enregistrer.
 */
export type {
  AdapterCapabilities,
  ObdAdapter,
  ObdTransport,
  DeviceInfo,
  PidSample,
  DtcSample,
  ScanSnapshot,
  ConnectOptions,
  AdapterFactory,
} from './adapters/types.js';
export { AdapterRegistry, adapterRegistry, sessionId } from './adapters/types.js';
export { Elm327Adapter } from './adapters/elm327Adapter.js';
export { SimulatorAdapter, SCENARIOS } from './adapters/simulatorAdapter.js';
export { MemoryTransport, UnavailableTransport } from './adapters/memoryTransport.js';
export { TcpTransport, COMMON_ELM327_HOSTS, COMMON_ELM327_PORTS } from './adapters/tcpTransport.js';
export type { TcpTransportOptions } from './adapters/tcpTransport.js';
export { ObdSimulator, SCENARIO_BY_ID } from './simulator/scenarios.js';
export type { SimulationScenario, SimulationScenarioId, SimulatedState, SimulationReading, ScenarioDtcSpec } from './simulator/scenarios.js';
export { PID_DEFINITIONS, PID_BY_KEY, PID_BY_OBD, CORE_PID_KEYS, EXTENDED_PID_KEYS } from './protocols/pids.js';
export type { PidDefinition } from './protocols/pids.js';
export { parseMode01, extractBytes, parseSupportedPids, protocolFromDpn, ELM_INIT_SEQUENCE, PROTOCOL_NAMES } from './protocols/elm327.js';
export { parseDtcResponse, decodeDtcBytes, encodeDtcCode, isValidDtc, DTC_FAMILIES } from './protocols/dtc.js';
export type { DecodedDtc } from './protocols/dtc.js';

/** Description des scénarios, exposée à l'interface (mode démo §31). */
export { SCENARIOS as SIMULATION_SCENARIOS } from './simulator/scenarios.js';
