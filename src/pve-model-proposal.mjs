import { randomUUID } from 'node:crypto';
import {
  createDeterministicPolicy,
  OPPONENT_OBSERVATION_SCHEMA_VERSION,
  toOpponentObservation,
} from './pve-opponent.mjs';

export const MODEL_PROPOSAL_SCHEMA_VERSION = 1;

export const MODEL_PROPOSAL_LIMITS = Object.freeze({
  decisionIntervalMs: 5_000,
  requestTimeoutMs: 2_000,
  maxRequestsPerMatch: 120,
  maxObservationBytes: 256 * 1024,
  maxInputTokens: 65_536,
  maxOutputTokens: 256,
  maxResponseBytes: 4 * 1024,
  maxUnitsPerAction: 64,
  maxDecisionAgeTicks: 60,
  maxEstimatedCostUsd: 1,
});

const REJECTION_NOTICE = /(?:\bREJECTED\b|^RESOURCE NODE (?:EMPTY|UNREACHABLE)\b|^NO REACHABLE WORKERS SELECTED\b|^TARGET (?:UNAVAILABLE|UNREACHABLE)\b)/i;

function validTeam(team) {
  return Number.isInteger(team) && (team === 0 || team === 1);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function hasExactKeys(value, requiredKeys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...requiredKeys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function assertValidIds(ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MODEL_PROPOSAL_LIMITS.maxUnitsPerAction
    || ids.some((id) => !Number.isSafeInteger(id) || id < 0)
    || new Set(ids).size !== ids.length) {
    throw new TypeError('Proposal unit IDs must be a unique bounded list of nonnegative integers.');
  }
}

/** Parse and authorize one proposal against the exact v1 observation sent for its request. */
export function parseModelProposal(content, { requestId, team, observation } = {}) {
  if (typeof content !== 'string') throw new TypeError('Proposal response must be JSON text.');
  if (Buffer.byteLength(content, 'utf8') > MODEL_PROPOSAL_LIMITS.maxResponseBytes) {
    throw new RangeError('Proposal response exceeds the 4 KiB limit.');
  }

  let proposal;
  try {
    proposal = JSON.parse(content);
  } catch {
    throw new TypeError('Proposal response is not valid JSON.');
  }

  if (!hasExactKeys(proposal, ['proposalSchemaVersion', 'requestId', 'action'])
    || proposal.proposalSchemaVersion !== MODEL_PROPOSAL_SCHEMA_VERSION
    || typeof proposal.requestId !== 'string' || proposal.requestId !== requestId) {
    throw new TypeError('Proposal envelope has an invalid schema or request binding.');
  }
  if (!validTeam(team) || observation?.schemaVersion !== OPPONENT_OBSERVATION_SCHEMA_VERSION
    || observation.team !== team || !Array.isArray(observation.units?.friendly)
    || !Array.isArray(observation.resourceNodes)) {
    throw new TypeError('Proposal is not bound to the assigned PvE v1 seat.');
  }

  const action = proposal.action;
  if (!isRecord(action) || typeof action.type !== 'string') {
    throw new TypeError('Proposal action must be a typed object.');
  }
  if (action.type === 'wait') {
    if (!hasExactKeys(action, ['type'])) throw new TypeError('Wait proposals do not accept extra fields.');
    return { type: 'wait' };
  }

  if (action.type === 'gather') {
    if (!hasExactKeys(action, ['type', 'ids', 'nodeId'])) {
      throw new TypeError('Gather proposals require exactly type, ids, and nodeId.');
    }
    assertValidIds(action.ids);
    if (typeof action.nodeId !== 'string' || action.nodeId.length < 1 || action.nodeId.length > 80) {
      throw new TypeError('Gather proposal requires a bounded resource-node ID.');
    }
    const friendly = new Map(observation.units.friendly.map((unit) => [unit.id, unit]));
    for (const id of action.ids) {
      const unit = friendly.get(id);
      if (!unit || unit.hp <= 0 || unit.kind !== 'worker') {
        throw new TypeError('Gather proposal references a non-owned or non-worker unit.');
      }
    }
    const node = observation.resourceNodes.find((entry) => entry.id === action.nodeId && entry.stock > 0);
    if (!node || !['food', 'wood'].includes(node.type)) {
      throw new TypeError('Gather proposal references a hidden, unknown, or empty resource node.');
    }
    return { type: 'gather', ids: [...action.ids], nodeId: action.nodeId };
  }

  if (action.type === 'attackMove') {
    if (!hasExactKeys(action, ['type', 'ids', 'x', 'z'])) {
      throw new TypeError('Attack-move proposals require exactly type, ids, x, and z.');
    }
    assertValidIds(action.ids);
    const friendly = new Map(observation.units.friendly.map((unit) => [unit.id, unit]));
    for (const id of action.ids) {
      const unit = friendly.get(id);
      if (!unit || unit.hp <= 0) throw new TypeError('Attack-move proposal references a non-owned unit.');
    }
    const { width, height } = observation.map ?? {};
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
      || !Number.isFinite(action.x) || !Number.isFinite(action.z)
      || Math.abs(action.x) > width / 2 || Math.abs(action.z) > height / 2) {
      throw new TypeError('Attack-move proposal coordinates must be finite and within the observed map.');
    }
    return { type: 'attackMove', ids: [...action.ids], x: action.x, z: action.z };
  }

  throw new TypeError(`Unsupported proposal action: ${action.type}.`);
}

function createEmptyMetrics() {
  return {
    requestsSent: 0,
    acceptedProposals: 0,
    rejectedProposals: 0,
    fallbackSlots: 0,
    fallbackCommands: 0,
    timeouts: 0,
    providerErrors: 0,
    staleResponses: 0,
    coalescedSlots: 0,
    unsettledProviderSlots: 0,
    skippedRequests: 0,
    observationBytes: 0,
    responseBytes: 0,
    estimatedInputTokens: 0,
    reportedInputTokens: 0,
    reportedOutputTokens: 0,
    reservedCostUsd: 0,
    reportedCostUsd: 0,
    providerBudgetLocked: false,
    latencyMs: [],
    decisionAgeTicks: [],
    fallbackReasons: {},
  };
}

function copyMetrics(metrics) {
  return {
    ...metrics,
    latencyMs: [...metrics.latencyMs],
    decisionAgeTicks: [...metrics.decisionAgeTicks],
    fallbackReasons: { ...metrics.fallbackReasons },
  };
}

function pushBounded(samples, value) {
  samples.push(value);
  if (samples.length > MODEL_PROPOSAL_LIMITS.maxRequestsPerMatch) samples.shift();
}

function normalizeEstimate(estimate) {
  if (!hasExactKeys(estimate, ['inputTokens', 'reservedCostUsd'])
    || !Number.isSafeInteger(estimate.inputTokens) || estimate.inputTokens < 0
    || !Number.isFinite(estimate.reservedCostUsd) || estimate.reservedCostUsd < 0) {
    throw new TypeError('Provider must return a conservative token and cost estimate.');
  }
  return estimate;
}

function normalizeProviderResult(result) {
  if (!isRecord(result) || !Object.hasOwn(result, 'content')
    || Object.keys(result).some((key) => !['content', 'usage'].includes(key))
    || typeof result.content !== 'string') {
    throw Object.assign(new TypeError('Provider response must contain JSON text and normalized usage.'), {
      code: 'PROVIDER_USAGE_INVALID',
    });
  }
  const usage = result.usage;
  if (!hasExactKeys(usage, ['inputTokens', 'outputTokens', 'costUsd'])
    || !Number.isSafeInteger(usage.inputTokens) || usage.inputTokens < 0
    || !Number.isSafeInteger(usage.outputTokens) || usage.outputTokens < 0
    || !Number.isFinite(usage.costUsd) || usage.costUsd < 0) {
    throw Object.assign(new TypeError('Provider must report normalized input, output, and cost usage for every response.'), {
      code: 'PROVIDER_USAGE_INVALID',
    });
  }
  return { content: result.content, usage };
}

function safeCallback(callback, value) {
  try { callback(value); } catch {}
}

/**
 * Attach a bounded proposal policy to a normal player WebSocket. This module
 * has no provider implementation; callers must inject one, and it is inert by
 * default. Accepted actions use the same outbound command shape as the bot.
 */
export function attachModelProposalOpponent(socket, options = {}) {
  const enabled = options.enabled === true;
  const initialMetrics = createEmptyMetrics();
  if (!enabled) {
    return {
      enabled: false,
      team: null,
      requestDecision: async () => ({ status: 'disabled' }),
      getMetrics: () => copyMetrics(initialMetrics),
      close() {},
    };
  }

  if (!socket || typeof socket.send !== 'function' || typeof socket.addEventListener !== 'function') {
    throw new TypeError('Proposal opponent needs a WebSocket-compatible player connection.');
  }
  const provider = options.provider;
  if (!provider || typeof provider.propose !== 'function' || typeof provider.estimateRequest !== 'function'
    || provider.reportsUsage !== true) {
    throw new TypeError('Enabled proposal mode requires an injected provider, conservative estimator, and usage reporting.');
  }

  const decisionIntervalMs = options.decisionIntervalMs ?? MODEL_PROPOSAL_LIMITS.decisionIntervalMs;
  const requestTimeoutMs = options.requestTimeoutMs ?? MODEL_PROPOSAL_LIMITS.requestTimeoutMs;
  if (!Number.isInteger(decisionIntervalMs)
    || decisionIntervalMs < MODEL_PROPOSAL_LIMITS.decisionIntervalMs || decisionIntervalMs > 60_000) {
    throw new TypeError('Proposal interval must be from 5000 to 60000 milliseconds.');
  }
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1
    || requestTimeoutMs > MODEL_PROPOSAL_LIMITS.requestTimeoutMs) {
    throw new TypeError('Proposal timeout must be from 1 to 2000 milliseconds.');
  }

  const now = options.now ?? Date.now;
  const schedule = options.setInterval ?? setInterval;
  const unschedule = options.clearInterval ?? clearInterval;
  const createRequestId = options.createRequestId ?? randomUUID;
  const onCommand = options.onCommand ?? (() => {});
  const onError = options.onError ?? (() => {});
  const onMetric = options.onMetric ?? (() => {});

  let team = null;
  let map = null;
  let latestState = null;
  let finished = false;
  let disposed = false;
  let socketClosed = false;
  let timer = null;
  let matchEpoch = 0;
  let lastSlotStartedAt = null;
  let nextClientOrderToken = 1;
  let activeRequest = null;
  let providerInFlight = false;
  let forceFallback = false;
  let fallbackCommands = [];
  let policy = createDeterministicPolicy(options.seed);
  let metrics = createEmptyMetrics();
  let reportedNoSeat = false;
  let previousWinner = null;
  const usedRequestIds = new Set();
  const pendingOrderTokens = new Set();

  const metric = (type, fields = {}) => safeCallback(onMetric, { type, ...fields });
  const reportError = (error) => safeCallback(onError, error instanceof Error ? error : new Error(String(error)));

  function resetForNewMatch() {
    matchEpoch++;
    if (activeRequest) {
      activeRequest.controller.abort();
      activeRequest = null;
    }
    metrics = createEmptyMetrics();
    usedRequestIds.clear();
    pendingOrderTokens.clear();
    lastSlotStartedAt = null;
    forceFallback = false;
    fallbackCommands = [];
    policy = createDeterministicPolicy(options.seed);
    finished = false;
  }

  function dispatch(command, observation, source) {
    if (socketClosed || disposed || !socket || socket.readyState !== 1) return false;
    const outbound = { ...command, clientOrderToken: nextClientOrderToken++ };
    try {
      socket.send(JSON.stringify(outbound));
    } catch (error) {
      reportError(error);
      return false;
    }
    pendingOrderTokens.add(outbound.clientOrderToken);
    if (source === 'fallback') metrics.fallbackCommands++;
    safeCallback(onCommand, { team, command: outbound, observation, source });
    metric('command_sent', { source, type: outbound.type, unitCount: outbound.ids?.length ?? 0 });
    return true;
  }

  function runFallback(observation, reason) {
    metrics.fallbackSlots++;
    metrics.fallbackReasons[reason] = (metrics.fallbackReasons[reason] ?? 0) + 1;
    metric('fallback', { reason });
    if (!observation || !policy) return null;
    try {
      let currentObservation = observation;
      if (latestState && team !== null) {
        try { currentObservation = toOpponentObservation(latestState, team, map); } catch {}
      }
      if (fallbackCommands.length === 0) fallbackCommands = policy.next(currentObservation);
      const command = fallbackCommands.shift();
      if (command) dispatch(command, currentObservation, 'fallback');
      return command ?? null;
    } catch (error) {
      reportError(error);
      return null;
    }
  }

  function recordSkipped(reason) {
    metrics.skippedRequests++;
    metric('request_skipped', { reason });
  }

  function resetAfterRejectedOrder() {
    forceFallback = true;
    fallbackCommands = [];
    policy = createDeterministicPolicy(options.seed);
    metric('command_rejected');
  }

  async function callProvider(record, request) {
    const controller = new AbortController();
    record.controller = controller;
    providerInFlight = true;
    let timeoutHandle;
    let timedOut = false;
    const timeoutError = Object.assign(new Error('Proposal provider timed out.'), {
      code: 'PROPOSAL_TIMEOUT',
    });
    const timeout = new Promise((resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort(timeoutError);
        reject(timeoutError);
      }, requestTimeoutMs);
    });
    const operation = Promise.resolve()
      .then(() => provider.propose(request, { signal: controller.signal }));
    void operation.then(
      () => { providerInFlight = false; },
      () => { providerInFlight = false; },
    );
    try {
      return await Promise.race([operation, timeout]);
    } catch (error) {
      if (timedOut) throw timeoutError;
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async function requestDecision() {
    if (socketClosed || disposed || finished || team === null || !latestState || socket.readyState !== 1) {
      return { status: 'not-ready' };
    }
    const startedAt = now();
    if (lastSlotStartedAt !== null && startedAt - lastSlotStartedAt < decisionIntervalMs) {
      return { status: 'not-due' };
    }
    if (activeRequest) {
      metrics.coalescedSlots++;
      metric('slot_coalesced', { sourceTick: latestState.tick });
      return { status: 'in-flight' };
    }
    let observation;
    try {
      observation = toOpponentObservation(latestState, team, map);
    } catch (error) {
      recordSkipped('invalid_observation');
      reportError(error);
      return { status: 'invalid-observation' };
    }
    lastSlotStartedAt = startedAt;
    if (providerInFlight) {
      metrics.unsettledProviderSlots++;
      recordSkipped('provider_unsettled');
      return { status: 'fallback', reason: 'provider_unsettled', command: runFallback(observation, 'provider_unsettled') };
    }

    if (forceFallback) {
      forceFallback = false;
      return { status: 'fallback', reason: 'command_rejected', command: runFallback(observation, 'command_rejected') };
    }
    if (metrics.providerBudgetLocked) {
      return { status: 'fallback', reason: 'provider_budget_locked', command: runFallback(observation, 'provider_budget_locked') };
    }
    if (metrics.requestsSent >= MODEL_PROPOSAL_LIMITS.maxRequestsPerMatch
      || metrics.reservedCostUsd >= MODEL_PROPOSAL_LIMITS.maxEstimatedCostUsd) {
      const reason = metrics.requestsSent >= MODEL_PROPOSAL_LIMITS.maxRequestsPerMatch ? 'request_budget' : 'cost_budget';
      return { status: 'fallback', reason, command: runFallback(observation, reason) };
    }

    let requestId;
    try { requestId = createRequestId(); } catch (error) {
      recordSkipped('request_id_error');
      reportError(error);
      return { status: 'fallback', reason: 'request_id_error', command: runFallback(observation, 'request_id_error') };
    }
    if (typeof requestId !== 'string' || requestId.length < 1 || requestId.length > 128
      || usedRequestIds.has(requestId)) {
      recordSkipped('invalid_request_id');
      return { status: 'fallback', reason: 'invalid_request_id', command: runFallback(observation, 'invalid_request_id') };
    }

    let observationBytes;
    let request;
    let estimate;
    try {
      const observationJson = JSON.stringify(observation);
      observationBytes = Buffer.byteLength(observationJson, 'utf8');
      if (observationBytes > MODEL_PROPOSAL_LIMITS.maxObservationBytes) {
        throw Object.assign(new RangeError('PvE v1 observation exceeds the 256 KiB request limit.'), { code: 'OBSERVATION_TOO_LARGE' });
      }
      request = {
        proposalSchemaVersion: MODEL_PROPOSAL_SCHEMA_VERSION,
        requestId,
        sourceTick: observation.tick,
        maxOutputTokens: MODEL_PROPOSAL_LIMITS.maxOutputTokens,
        observation: JSON.parse(observationJson),
      };
      deepFreeze(request.observation);
      Object.freeze(request);
      estimate = normalizeEstimate(provider.estimateRequest(request));
      if (estimate.inputTokens > MODEL_PROPOSAL_LIMITS.maxInputTokens) {
        throw Object.assign(new RangeError('Estimated provider input exceeds the 65,536 token limit.'), { code: 'INPUT_TOKENS_TOO_LARGE' });
      }
      if (estimate.reservedCostUsd > MODEL_PROPOSAL_LIMITS.maxEstimatedCostUsd - metrics.reservedCostUsd + Number.EPSILON) {
        throw Object.assign(new RangeError('Conservative provider cost reservation exceeds the $1.00 match limit.'), { code: 'COST_BUDGET' });
      }
    } catch (error) {
      const reason = error?.code === 'OBSERVATION_TOO_LARGE' ? 'observation_bytes'
        : error?.code === 'INPUT_TOKENS_TOO_LARGE' ? 'input_tokens'
          : error?.code === 'COST_BUDGET' ? 'cost_budget' : 'estimate_error';
      recordSkipped(reason);
      if (reason === 'estimate_error') reportError(error);
      return { status: 'fallback', reason, command: runFallback(observation, reason) };
    }

    usedRequestIds.add(requestId);
    const record = {
      requestId,
      team,
      matchEpoch,
      sourceTick: observation.tick,
      startedAt,
      observationBytes,
      inputTokens: estimate.inputTokens,
      reservedCostUsd: estimate.reservedCostUsd,
      controller: null,
    };
    activeRequest = record;
    metrics.requestsSent++;
    metrics.observationBytes += observationBytes;
    metrics.estimatedInputTokens += estimate.inputTokens;
    metrics.reservedCostUsd += estimate.reservedCostUsd;
    metric('request_sent', {
      sourceTick: record.sourceTick,
      observationBytes,
      estimatedInputTokens: estimate.inputTokens,
      reservedCostUsd: estimate.reservedCostUsd,
    });

    try {
      const result = await callProvider(record, request);
      if (activeRequest !== record || disposed || matchEpoch !== record.matchEpoch || team !== record.team) {
        metrics.staleResponses++;
        metric('response_discarded', { reason: 'request_superseded', sourceTick: record.sourceTick });
        return { status: 'stale' };
      }
      const normalized = normalizeProviderResult(result);
      metrics.responseBytes += Buffer.byteLength(normalized.content, 'utf8');
      if (normalized.usage?.inputTokens !== undefined) metrics.reportedInputTokens += normalized.usage.inputTokens;
      if (normalized.usage?.outputTokens !== undefined) metrics.reportedOutputTokens += normalized.usage.outputTokens;
      const ageTicks = latestState?.tick - record.sourceTick;
      if (!Number.isSafeInteger(ageTicks) || ageTicks < 0
        || ageTicks > MODEL_PROPOSAL_LIMITS.maxDecisionAgeTicks) {
        metrics.staleResponses++;
        pushBounded(metrics.latencyMs, Math.max(0, now() - record.startedAt));
        if (Number.isSafeInteger(ageTicks) && ageTicks >= 0) pushBounded(metrics.decisionAgeTicks, ageTicks);
        metric('response_discarded', { reason: 'decision_age', sourceTick: record.sourceTick, ageTicks });
        return { status: 'fallback', reason: 'stale_response', command: runFallback(observation, 'stale_response') };
      }
      pushBounded(metrics.latencyMs, Math.max(0, now() - record.startedAt));
      pushBounded(metrics.decisionAgeTicks, ageTicks);
      if (normalized.usage?.inputTokens !== undefined
        && normalized.usage.inputTokens > MODEL_PROPOSAL_LIMITS.maxInputTokens) {
        throw Object.assign(new RangeError('Reported provider input exceeded the token limit.'), {
          code: 'PROVIDER_BUDGET_VIOLATION',
        });
      }
      if (normalized.usage?.outputTokens !== undefined
        && normalized.usage.outputTokens > MODEL_PROPOSAL_LIMITS.maxOutputTokens) {
        throw Object.assign(new RangeError('Reported provider output exceeded the token limit.'), {
          code: 'PROVIDER_BUDGET_VIOLATION',
        });
      }
      if (normalized.usage?.costUsd !== undefined) {
        metrics.reportedCostUsd += normalized.usage.costUsd;
        if (normalized.usage.costUsd > record.reservedCostUsd + Number.EPSILON) {
          throw Object.assign(new RangeError('Reported provider cost exceeded its conservative reservation.'), {
            code: 'PROVIDER_BUDGET_VIOLATION',
          });
        }
      }

      let action;
      try {
        action = parseModelProposal(normalized.content, { requestId, team: record.team, observation });
      } catch (error) {
        metrics.rejectedProposals++;
        metric('proposal_rejected', { reason: 'schema_or_authority' });
        return { status: 'fallback', reason: 'invalid_proposal', command: runFallback(observation, 'invalid_proposal') };
      }

      metrics.acceptedProposals++;
      metric('proposal_accepted', { action: action.type, latencyMs: metrics.latencyMs.at(-1), ageTicks });
      fallbackCommands = [];
      policy = createDeterministicPolicy(options.seed);
      if (action.type === 'wait') return { status: 'accepted', action };
      return { status: dispatch(action, observation, 'proposal') ? 'accepted' : 'not-sent', action };
    } catch (error) {
      const isTimeout = error?.code === 'PROPOSAL_TIMEOUT';
      if (activeRequest !== record || disposed || matchEpoch !== record.matchEpoch) {
        metrics.staleResponses++;
        metric('response_discarded', { reason: 'late_or_superseded', sourceTick: record.sourceTick });
        return { status: 'stale' };
      }
      if (isTimeout) metrics.timeouts++;
      else metrics.providerErrors++;
      if (error?.code === 'PROVIDER_USAGE_INVALID' || error?.code === 'PROVIDER_BUDGET_VIOLATION') {
        metrics.providerBudgetLocked = true;
      }
      const reason = isTimeout ? 'timeout' : 'provider_error';
      pushBounded(metrics.latencyMs, Math.max(0, now() - record.startedAt));
      metric('provider_failure', { reason, latencyMs: metrics.latencyMs.at(-1) });
      if (!isTimeout) reportError(error);
      return { status: 'fallback', reason, command: runFallback(observation, reason) };
    } finally {
      if (activeRequest === record) activeRequest = null;
    }
  }

  const handleMessage = async (event) => {
    let message;
    try {
      const data = typeof event?.data === 'string' ? event.data
        : typeof event?.data?.text === 'function' ? await event.data.text()
          : String(event?.data ?? '');
      message = JSON.parse(data);
    } catch {
      return;
    }

    if (message.type === 'welcome') {
      resetForNewMatch();
      team = validTeam(message.player?.team) ? message.player.team : null;
      map = message.map && typeof message.map === 'object' ? message.map : null;
      latestState = message.state?.type === 'state' ? message.state : null;
      previousWinner = Number.isInteger(latestState?.winner) ? latestState.winner : null;
      if (team === null && !reportedNoSeat) {
        reportedNoSeat = true;
        reportError(new Error('The server assigned this connection as a spectator; no proposal seat is available.'));
      }
    } else if (message.type === 'mapChange') {
      resetForNewMatch();
      map = message.map && typeof message.map === 'object' ? message.map : map;
      latestState = message.state?.type === 'state' ? message.state : latestState;
      previousWinner = Number.isInteger(latestState?.winner) ? latestState.winner : null;
    } else if (message.type === 'notice' && typeof message.message === 'string') {
      if (message.message.startsWith('BATTLEFIELD RESET')) {
        resetForNewMatch();
        latestState = null;
        previousWinner = null;
      }
      if (Number.isSafeInteger(message.clientOrderToken)
        && pendingOrderTokens.delete(message.clientOrderToken)
        && REJECTION_NOTICE.test(message.message)) {
        resetAfterRejectedOrder();
      }
    } else if (message.type === 'state') {
      latestState = message;
      const winner = Number.isInteger(message.winner) ? message.winner : null;
      if (previousWinner !== null && previousWinner >= 0 && winner === -1) resetForNewMatch();
      previousWinner = winner;
      if (winner !== null && winner >= 0) finished = true;
    } else if (message.type === 'victory') {
      finished = true;
    }
  };

  const handleClose = () => {
    socketClosed = true;
    if (timer) unschedule(timer);
    if (activeRequest) {
      activeRequest.controller.abort();
      activeRequest = null;
    }
  };

  socket.addEventListener('message', handleMessage);
  socket.addEventListener('close', handleClose);
  timer = schedule(() => { void requestDecision(); }, decisionIntervalMs);

  return {
    enabled: true,
    get team() { return team; },
    requestDecision,
    getMetrics: () => copyMetrics(metrics),
    close() {
      if (disposed) return;
      disposed = true;
      if (timer) unschedule(timer);
      if (activeRequest) {
        activeRequest.controller.abort();
        activeRequest = null;
      }
      socket.removeEventListener?.('message', handleMessage);
      socket.removeEventListener?.('close', handleClose);
    },
  };
}
