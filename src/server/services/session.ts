import type {
  SessionState,
  ZoneState,
  ZoneInfo,
  DeploymentState,
} from './cloudflare/types.js';

// In-memory session store: Map<socketId, SessionState>
const sessions = new Map<string, SessionState>();

/**
 * Session manager for storing per-socket state
 * Replaces the YAML file-based configuration approach
 */
export const sessionManager = {
  /**
   * Create a new session for a socket
   */
  create(socketId: string, cloudflareToken: string): SessionState {
    const state: SessionState = {
      cloudflareToken,
      crowdsecLapiUrl: '',
      crowdsecLapiKey: '',
      accounts: [],
      deploymentState: {
        workerScriptName: 'crowdsec-cloudflare-worker-bouncer',
        decisionsSyncScriptName: 'crowdsec-decisions-sync-worker',
        turnstileWidgets: new Map(),
      },
    };
    sessions.set(socketId, state);
    return state;
  },

  /**
   * Get session by socket ID
   */
  get(socketId: string): SessionState | undefined {
    return sessions.get(socketId);
  },

  /**
   * Check if a session exists
   */
  has(socketId: string): boolean {
    return sessions.has(socketId);
  },

  /**
   * Update session with partial state
   */
  update(socketId: string, updates: Partial<SessionState>): SessionState | undefined {
    const session = sessions.get(socketId);
    if (session) {
      Object.assign(session, updates);
    }
    return session;
  },

  /**
   * Store discovered zones in session, grouped by account
   */
  setZones(socketId: string, zones: ZoneState[]): void {
    const session = sessions.get(socketId);
    if (!session) {return;}

    // Group zones by account
    const accountMap = new Map<string, ZoneState[]>();
    for (const zone of zones) {
      const existing = accountMap.get(zone.accountId) || [];
      existing.push(zone);
      accountMap.set(zone.accountId, existing);
    }

    // Build accounts array
    session.accounts = [];
    for (const [accountId, accountZones] of accountMap) {
      session.accounts.push({
        id: accountId,
        name: accountZones[0]?.accountName || accountId,
        zones: accountZones,
      });
    }
  },

  /**
   * Update zone selection in session
   */
  updateSelectedZones(socketId: string, selectedZoneIds: string[]): void {
    const session = sessions.get(socketId);
    if (!session) {return;}

    for (const account of session.accounts) {
      for (const zone of account.zones) {
        zone.selected = selectedZoneIds.includes(zone.id);
      }
    }
  },

  /**
   * Get all zones from session (for zones-loaded event)
   */
  getAllZones(socketId: string): ZoneInfo[] {
    const session = sessions.get(socketId);
    if (!session) {return [];}

    return session.accounts.flatMap((account) =>
      account.zones.map((zone) => ({
        id: zone.id,
        domain: zone.domain,
        accountId: zone.accountId,
        accountName: zone.accountName,
        actions: zone.actions,
        defaultAction: zone.defaultAction,
        selected: zone.selected,
      }))
    );
  },

  /**
   * Get selected zones from session
   */
  getSelectedZones(socketId: string): ZoneState[] {
    const session = sessions.get(socketId);
    if (!session) {return [];}

    return session.accounts.flatMap((account) =>
      account.zones.filter((zone) => zone.selected)
    );
  },

  /**
   * Get selected zones grouped by account
   */
  getSelectedZonesByAccount(socketId: string): Map<string, ZoneState[]> {
    const session = sessions.get(socketId);
    const result = new Map<string, ZoneState[]>();
    if (!session) {return result;}

    for (const account of session.accounts) {
      const selectedZones = account.zones.filter((zone) => zone.selected);
      if (selectedZones.length > 0) {
        result.set(account.id, selectedZones);
      }
    }

    return result;
  },

  /**
   * Delete session (on disconnect)
   */
  delete(socketId: string): void {
    sessions.delete(socketId);
  },

  /**
   * Get deployment state
   */
  getDeploymentState(socketId: string): DeploymentState | undefined {
    return sessions.get(socketId)?.deploymentState;
  },

  /**
   * Update deployment state
   */
  updateDeploymentState(
    socketId: string,
    updates: Partial<DeploymentState>
  ): void {
    const session = sessions.get(socketId);
    if (session) {
      Object.assign(session.deploymentState, updates);
    }
  },
};
