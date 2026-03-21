import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const USE_DOCKER = process.env.AGENTS_USE_DOCKER === 'true';

// Allowlist of permitted service names. Override via comma-separated AGENTS_ALLOWED_SERVICES env var.
const ALLOWED_SERVICES: Set<string> = (() => {
  const fromEnv = process.env.AGENTS_ALLOWED_SERVICES;
  if (fromEnv) return new Set(fromEnv.split(',').map((s) => s.trim()).filter(Boolean));
  return new Set(['api', 'processor', 'web', 'nginx', 'agents', 'db', 'redis']);
})();

export interface DebugReport {
  timestamp: string;
  service: string;
  logs: string;
  analysis: string;
}

export class DebugAgent {
  private reports: DebugReport[] = [];

  getReports(): DebugReport[] {
    return this.reports.slice(-10); // Last 10 reports
  }

  async analyzeService(service: string): Promise<DebugReport> {
    let logs = '';

    if (!ALLOWED_SERVICES.has(service)) {
      logs = `[Debug] Unknown service '${service}'. Allowed: ${[...ALLOWED_SERVICES].join(', ')}`;
    } else if (USE_DOCKER) {
      try {
        // Use execFile (not exec) to avoid shell injection — args are passed as array
        const { stdout } = await execFileAsync('docker', ['logs', service, '--tail', '50']);
        logs = stdout;
      } catch (err) {
        logs = `Could not retrieve logs: ${err instanceof Error ? err.message : String(err)}`;
      }
    } else {
      logs = `[Debug] Docker not enabled. Set AGENTS_USE_DOCKER=true to enable log collection for service: ${service}`;
    }

    // Simple pattern-based analysis
    const analysis = this.analyzeLog(logs, service);

    const report: DebugReport = {
      timestamp: new Date().toISOString(),
      service,
      logs: logs.slice(0, 2000), // Limit log size
      analysis,
    };

    this.reports.push(report);
    return report;
  }

  private analyzeLog(logs: string, service: string): string {
    const patterns = [
      { re: /ECONNREFUSED/i, msg: 'Connection refused - dependency service may be down' },
      { re: /out of memory/i, msg: 'Memory issue detected' },
      { re: /FATAL/i, msg: 'Fatal error detected in logs' },
      { re: /prisma.*error/i, msg: 'Database error detected' },
      { re: /redis.*error/i, msg: 'Redis connection error detected' },
    ];

    const found = patterns.filter(({ re }) => re.test(logs)).map(({ msg }) => msg);

    if (found.length === 0) return `No known issues detected in ${service} logs`;
    return `Issues found in ${service}: ${found.join('; ')}`;
  }
}
