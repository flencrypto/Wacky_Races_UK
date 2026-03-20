import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { prisma } from './lib/prisma';
import { redis, redisSub, redisPub } from './lib/redis';
import authPlugin from './plugins/auth';
import healthRoute from './routes/health';
import authRoutes from './routes/auth';
import eventsRoutes from './routes/events';
import carsRoutes from './routes/cars';
import positionsRoutes from './routes/positions';
import feedRoutes from './routes/feed';
import wsRoutes from './routes/ws';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production-32ch';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

async function main() {
  // Connect to Redis
  await redis.connect();
  await redisSub.connect();
  await redisPub.connect();

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: JWT_SECRET,
  });

  await fastify.register(websocket);
  await fastify.register(authPlugin);

  // Register routes
  await fastify.register(healthRoute);
  await fastify.register(authRoutes);
  await fastify.register(eventsRoutes);
  await fastify.register(carsRoutes);
  await fastify.register(positionsRoutes);
  await fastify.register(feedRoutes);
  await fastify.register(wsRoutes);

  // Global error handler
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation error', details: error.message });
    }
    return reply.status(error.statusCode ?? 500).send({ error: error.message ?? 'Internal server error' });
  });

  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  fastify.log.info(`Server listening on port ${PORT}`);
}

// Graceful shutdown
const shutdown = async () => {
  fastify.log.info('Shutting down...');
  await fastify.close();
  await prisma.$disconnect();
  await redis.quit();
  await redisSub.quit();
  await redisPub.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
