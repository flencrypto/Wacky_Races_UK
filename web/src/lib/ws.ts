const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:3000';

type MessageCallback = (data: unknown) => void;

interface Subscription {
  channel: string;
  callback: MessageCallback;
}

class WsManager {
  private ws: WebSocket | null = null;
  private subscriptions: Subscription[] = [];
  private reconnectTimer: number | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private connecting = false;

  private connect() {
    if (this.connecting || this.ws?.readyState === WebSocket.OPEN) return;
    this.connecting = true;

    const url = `${WS_URL}/v1/ws`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connecting = false;
      this.reconnectDelay = 1000;
      console.log('[WS] Connected');

      // Re-subscribe to all channels
      const channels = [...new Set(this.subscriptions.map((s) => s.channel))];
      for (const channel of channels) {
        this.ws!.send(JSON.stringify({ type: 'subscribe', channel }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          channel?: string;
          data?: unknown;
          type?: string;
        };
        if (msg.channel && msg.data !== undefined) {
          for (const sub of this.subscriptions) {
            if (sub.channel === msg.channel) {
              sub.callback(msg.data);
            }
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.connecting = false;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.connecting = false;
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  subscribe(channel: string, callback: MessageCallback): () => void {
    const sub: Subscription = { channel, callback };
    this.subscriptions.push(sub);

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    } else if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', channel }));
    }

    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s !== sub);

      const remaining = this.subscriptions.filter((s) => s.channel === channel);
      if (remaining.length === 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'unsubscribe', channel }));
      }
    };
  }
}

const wsManager = new WsManager();

export function wsSubscribe(channel: string, callback: MessageCallback): () => void {
  return wsManager.subscribe(channel, callback);
}
