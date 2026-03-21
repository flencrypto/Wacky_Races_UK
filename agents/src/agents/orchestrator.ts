import { BuildAgent } from './build';
import { OpsAgent } from './ops';
import { DebugAgent } from './debug';

const HEARTBEAT_INTERVAL_MS = parseInt(process.env.AGENTS_HEARTBEAT_INTERVAL_MS ?? '10000', 10);

export interface OrchestratorStatus {
  uptime: number;
  lastHeartbeat: string;
  services: {
    build: ReturnType<BuildAgent['getStatus']>;
    ops: ReturnType<OpsAgent['getHealth']>;
    debugReports: ReturnType<DebugAgent['getReports']>;
  };
}

export class Orchestrator {
  private startTime = Date.now();
  private lastHeartbeat = new Date().toISOString();
  private buildAgent = new BuildAgent();
  private opsAgent = new OpsAgent();
  private debugAgent = new DebugAgent();
  private heartbeatId?: NodeJS.Timeout;

  getStatus(): OrchestratorStatus {
    return {
      uptime: Date.now() - this.startTime,
      lastHeartbeat: this.lastHeartbeat,
      services: {
        build: this.buildAgent.getStatus(),
        ops: this.opsAgent.getHealth(),
        debugReports: this.debugAgent.getReports(),
      },
    };
  }

  async triggerDebug(service: string) {
    return this.debugAgent.analyzeService(service);
  }

  start(): void {
    this.opsAgent.start();

    this.heartbeatId = setInterval(async () => {
      this.lastHeartbeat = new Date().toISOString();
      await this.buildAgent.check();

      // If ops reports service down, trigger debug analysis
      const health = this.opsAgent.getHealth();
      if (health.status === 'down') {
        console.warn(`[Orchestrator] Service ${health.service} is down, triggering debug analysis`);
        await this.debugAgent.analyzeService(health.service);
      }
    }, HEARTBEAT_INTERVAL_MS);

    console.log('[Orchestrator] Started');
  }

  stop(): void {
    this.opsAgent.stop();
    if (this.heartbeatId) clearInterval(this.heartbeatId);
  }
}
