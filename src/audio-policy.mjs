// Audio decisions live outside the renderer so every unit snapshot can be reduced
// to a few meaningful events rather than a sound per unit.
export function cueForNotice(message, { localTeam = null, tokenized = false } = {}) {
  const notice = String(message || '').toUpperCase();
  const teamName = localTeam === 0 ? 'AZURE' : localTeam === 1 ? 'EMBER' : null;
  if (!notice) return null;
  if (teamName && notice.startsWith(`${teamName} `) && notice.includes(' DESTROYED ·')) return 'base-lost';
  if (notice.startsWith('RESOURCE NODE EMPTY ·')) return 'resource-empty';
  if (/(REJECTED|FAILED|UNAVAILABLE|UNREACHABLE|SERVER BUSY|CANCELLED|SUPERSEDED|MATCH OVER|UNIT CAP REACHED)/.test(notice)) return 'reject';
  if (notice.startsWith('RALLY POINT ')) return 'gather';
  if (/^(WORKER|INFANTRY|ARCHER) QUEUED ·/.test(notice)) return 'queue';
  if (/^.+ STARTED ·/.test(notice) && !notice.startsWith('PLANNING ')) return 'queue';
  if (teamName && (notice.startsWith(`${teamName} INFANTRY FORGING COMPLETE ·`)
    || notice.startsWith(`${teamName} ARCHER FLETCHING COMPLETE ·`))) return 'research-complete';
  if (notice.includes(' COMPLETE ·') && teamName && notice.startsWith(`${teamName} `)) return 'complete';
  if (teamName && notice.startsWith(`${teamName} `) && notice.endsWith(' READY')) return 'complete';
  if (notice.includes(' PLACED ·') && tokenized) return 'build';
  return null;
}

export function isLocalRejection(message) {
  return /^(NO |SELECT YOUR|SELECT WORKERS|SELECT MILITARY|SPECTATORS CANNOT|SERVER CONNECTION IS OFFLINE|COMMAND TOO LARGE|MOVE THE POINTER OVER)/
    .test(String(message || '').toUpperCase())
    || /( REJECTED| FAILED| QUEUE FULL| SITE BLOCKED| NEEDS \d+| TARGET UNREACHABLE)/
      .test(String(message || '').toUpperCase());
}

export class CombatAudioGate {
  constructor() {
    this.lastDamageAt = -Infinity;
    this.lastSelectedAt = -Infinity;
    this.lastBaseAt = -Infinity;
  }

  reset() {
    this.lastDamageAt = -Infinity;
    this.lastSelectedAt = -Infinity;
    this.lastBaseAt = -Infinity;
  }

  observe({ friendlyDamage = 0, selectedDamage = 0, buildingDamage = 0 }, now) {
    if (buildingDamage > 0 && now - this.lastBaseAt >= 12000) {
      this.lastBaseAt = now;
      this.lastDamageAt = now;
      return 'base-alert';
    }
    if (selectedDamage > 0 && now - this.lastSelectedAt >= 12000) {
      this.lastSelectedAt = now;
      this.lastDamageAt = now;
      return 'selected-alert';
    }
    if (friendlyDamage > 0) {
      const newEngagement = now - this.lastDamageAt >= 9000;
      this.lastDamageAt = now;
      if (newEngagement) return 'battle-alert';
    }
    return null;
  }
}
