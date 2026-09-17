import { buildApp } from '/home/user/XAMOTO/backend/src/app.js';
import { writeFileSync } from 'node:fs';

function keys(v: unknown, prefix = '', out: string[] = [], depth = 0): string[] {
  if (depth > 3 || v === null || typeof v !== 'object') return out;
  if (Array.isArray(v)) { if (v.length) keys(v[0], `${prefix}[]`, out, depth + 1); return out; }
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const t = Array.isArray(val) ? 'array' : val === null ? 'null' : typeof val;
    out.push(`${path}: ${t}`);
    if (t === 'object' || t === 'array') keys(val, path, out, depth + 1);
  }
  return out;
}

async function main() {
  const app = await buildApp({ seed: true, logger: false });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/auth/demo', payload: {} });
  const token = (login.json() as any).token as string;
  const H = { authorization: `Bearer ${token}` };
  const vehicles = (await app.inject({ method: 'GET', url: '/api/vehicles', headers: H })).json() as any;
  const vehicleId = vehicles.vehicles[0].id as string;

  const scan = (await app.inject({ method: 'POST', url: '/api/scans', headers: H, payload: { vehicleId, mode: 'simulator', scenario: 'multiple_dtc', samples: 5, symptoms: [{ key: 'loss_of_power', present: true }] } })).json() as any;
  const diagId = scan.diagnosticSessionId as string;

  const calls: Array<[string, string, string, unknown?]> = [
    ['vehicles', 'GET', '/api/vehicles'],
    ['vehicle', 'GET', `/api/vehicles/${vehicleId}`],
    ['passport', 'GET', `/api/vehicles/${vehicleId}/passport`],
    ['maintenance', 'GET', `/api/vehicles/${vehicleId}/maintenance`],
    ['plan', 'POST', `/api/vehicles/${vehicleId}/maintenance/plan`, { odometerKm: 120000 }],
    ['predictive', 'GET', `/api/vehicles/${vehicleId}/predictive`],
    ['scans', 'GET', `/api/scans?vehicleId=${vehicleId}`],
    ['scansim', 'GET', `/api/scans/${scan.sessionId}`],
    ['scan', 'POST', '/api/scans'],
    ['diags', 'GET', `/api/diagnostics?vehicleId=${vehicleId}`],
    ['diag', 'GET', `/api/diagnostics/${diagId}`],
    ['cid', 'GET', `/api/diagnostics/${diagId}/can-i-drive`],
    ['tests', 'GET', `/api/diagnostics/${diagId}/tests`],
    ['compare', 'POST', `/api/diagnostics/${diagId}/compare`, { beforeScanId: null }],
    ['second', 'POST', `/api/diagnostics/${diagId}/second-opinion`, { externalDiagnosis: 'Catalyseur HS', externalCauses: [], proposedRepair: 'Remplacement catalyseur', proposedAmount: 450000, currency: 'XOF' }],
    ['inspection', 'POST', `/api/vehicles/${vehicleId}/inspection`, { odometerKm: 120000 }],
    ['inspections', 'GET', `/api/vehicles/${vehicleId}/inspections`],
    ['garages', 'GET', '/api/garages?country=SN'],
    ['garage', 'GET', '/api/garages/g1'],
    ['parts', 'GET', '/api/parts?q=filtre'],
    ['alerts', 'GET', '/api/alerts'],
    ['simscen', 'GET', '/api/obd/simulator/scenarios'],
    ['candidates', 'GET', '/api/obd/candidates'],
    ['aidx', 'POST', '/api/assistant/ask', { question: 'Puis-je rouler ?', diagnosticSessionId: diagId }],
    ['conv', 'GET', '/api/assistant/conversations'],
    ['caps', 'GET', '/api/assistant/capabilities'],
    ['ksyms', 'GET', '/api/knowledge/symptoms'],
    ['ktests', 'GET', '/api/knowledge/tests'],
    ['kdtc', 'GET', '/api/knowledge/dtc/P0420'],
    ['kdtcu', 'GET', '/api/knowledge/dtc/unknown/P1234'],
    ['testres', 'POST', `/api/diagnostics/${diagId}/tests/test_battery_rest_voltage/result`, { outcome: 'ok', confirmed: true }],
    ['report', 'POST', '/api/reports', { diagnosticSessionId: diagId, kind: 'diagnostic', includePersonalNotes: true }],
    ['reports', 'GET', '/api/reports'],
    ['quot', 'POST', '/api/quotes', { vehicleId, garageId: null, items: [{ label: 'Remplacement catalyseur', amount: 450000 }], currency: 'XOF' }],
  ];

  for (const [name, method, url, payload] of calls) {
    const res = await app.inject({ method: method as any, url, headers: H, payload: payload as any });
    const body = res.body ? JSON.parse(res.body) : null;
    writeFileSync(`/tmp/shapes/${name}.json`, JSON.stringify(body, null, 2));
    writeFileSync(`/tmp/shapes/${name}.status`, String(res.statusCode));
    console.log(`--- ${name} ${method} ${url} -> ${res.statusCode}`);
    if (res.statusCode < 300) console.log(keys(body).join('\n'));
    else console.log(JSON.stringify(body).slice(0, 300));
  }
  await app.close();
}
void main();
