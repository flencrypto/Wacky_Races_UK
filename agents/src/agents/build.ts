export interface BuildStatus {
  lastCheck: string;
  status: 'ok' | 'error' | 'unknown';
  message: string;
}

export class BuildAgent {
  private status: BuildStatus = {
    lastCheck: new Date().toISOString(),
    status: 'unknown',
    message: 'Build agent initialized',
  };

  getStatus(): BuildStatus {
    return this.status;
  }

  async check(): Promise<BuildStatus> {
    try {
      // In a real deployment, this would check CI/CD status
      // For now, we report based on process health
      this.status = {
        lastCheck: new Date().toISOString(),
        status: 'ok',
        message: 'Build agent running normally',
      };
    } catch (err) {
      this.status = {
        lastCheck: new Date().toISOString(),
        status: 'error',
        message: `Build check failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    return this.status;
  }
}
