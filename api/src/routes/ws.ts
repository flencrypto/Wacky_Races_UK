import { FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';
import { redisSub } from '../lib/redis';

interface WsClient {
  socket: WebSocket;
  channels: Set<string>;
  userId?: string;
  role?: string;
}

const clients = new Set<WsClient>();

let subscribed = false;

async function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;

  await redisSub.subscribe('position_update', 'feed_update');

  redisSub.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message) as { type: string; eventId?: string; carId?: string };

      for (const client of clients) {
        if (client.socket.readyState !== WebSocket.OPEN) continue;

        let logicalChannel: string | undefined;

        if (data.type === 'position' && data.carId) {
          if (client.channels.has(`car:${data.carId}`)) {
            logicalChannel = `car:${data.carId}`;
          } else if (data.eventId && client.channels.has(`event:${data.eventId}`)) {
            logicalChannel = `event:${data.eventId}`;
          }
        }

        if (data.type === 'post' && data.eventId) {
          if (client.channels.has(`event:${data.eventId}`)) {
            logicalChannel = `event:${data.eventId}`;
          }
        }

        if (logicalChannel) {
          client.socket.send(JSON.stringify({ channel: logicalChannel, data }));
        }
      }
    } catch {
      // ignore parse errors
    }
  });
}

const wsRoutes: FastifyPluginAsync = async (fastify) => {
  await ensureSubscribed();

  fastify.get('/v1/ws', { websocket: true, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, (socket, request) => {
    const client: WsClient = {
      socket,
      channels: new Set(),
    };

    // Try to authenticate
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = fastify.jwt.verify<{ sub: string; email: string; role: string }>(
          authHeader.slice(7),
        );
        client.userId = payload.sub;
        client.role = payload.role;
      } catch {
        // unauthenticated WS allowed
      }
    }

    clients.add(client);

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; channel?: string };

        if (msg.type === 'subscribe' && msg.channel) {
          client.channels.add(msg.channel);
          socket.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
        }

        if (msg.type === 'unsubscribe' && msg.channel) {
          client.channels.delete(msg.channel);
        }

        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore
      }
    });

    socket.on('close', () => {
      clients.delete(client);
    });

    socket.send(JSON.stringify({ type: 'connected' }));
  });
};

export default wsRoutes;
