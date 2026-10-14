import { configuredPublicOrigins, sameOriginRequest } from '../../src/server/transport/origin-policy.mjs';
import { advanceTickDeadline } from '../../src/server/orchestration/simulation-scheduler.mjs';

// Compile actual HTTP request and environment types as well as the fixture shape.
/** @param {import('node:http').IncomingMessage} request */
export function checkedOrigin(request) {
  const allowedOrigins = configuredPublicOrigins(process.env);
  for (const origin of allowedOrigins) origin.toUpperCase();
  const accepted = sameOriginRequest(request, { allowedOrigins, httpsTerminatedAtEdge: true });
  sameOriginRequest({ headers: { origin: 'https://play.example' }, socket: { encrypted: true } });
  return accepted.valueOf();
}

/** @param {number} deadlineMs @param {number} completedAtMs @param {number} intervalMs */
export function checkedDeadline(deadlineMs, completedAtMs, intervalMs) {
  const result = advanceTickDeadline(deadlineMs, completedAtMs, intervalMs);
  return result.nextDeadlineMs + result.skippedTickSlots * intervalMs;
}
