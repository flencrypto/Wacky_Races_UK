const DEFAULT_API_URL = process.env.AGENTS_API_BASE_URL ?? 'http://localhost:3000';
const CHECK_INTERVAL_MS = parseInt(process.env.AGENTS_OPS_INTERVAL_MS ?? '15000', 10);

export interface ServiceHealth {
  service: string;
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  lastCheck: string;
  responseTimeMs?: number;
  details?: Record<string, unknown>;
}

export class OpsAgent {
  private health: ServiceHealth = {
    service: 'api',
    status: 'unknown',
    lastCheck: new Date().toISOString(),
  };

  private intervalId?: NodeJS.Timeout;

  getHealth(): ServiceHealth {
    return this.health;
  }

  async checkOnce(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const res = await fetch(`${DEFAULT_API_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const responseTimeMs = Date.now() - start;
      const body = await res.json() as { status: string; checks: Record<string, string> };

      this.health = {
        service: 'api',
        status: body.status === 'ok' ? 'ok' : 'degraded',
        lastCheck: new Date().toISOString(),
        responseTimeMs,
        details: body.checks,
      };
    } catch (err) {
      this.health = {
        service: 'api',
        status: 'down',
        lastCheck: new Date().toISOString(),
        responseTimeMs: Date.now() - start,
        details: { error: err instanceof Error ? err.message : String(err) },
      };
    }
    return this.health;
  }

  start(): void {
    this.intervalId = setInterval(() => {
      this.checkOnce().catch(console.error);
    }, CHECK_INTERVAL_MS);
    // Run immediately
    this.checkOnce().catch(console.error);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
