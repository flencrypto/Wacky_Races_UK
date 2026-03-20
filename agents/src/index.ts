import Fastify from 'fastify';
import { Orchestrator } from './agents/orchestrator';

const PORT = parseInt(process.env.AGENTS_STATUS_PORT ?? '4000', 10);

const fastify = Fastify({ logger: true });
const orchestrator = new Orchestrator();

fastify.get('/status', async (_request, reply) => {
  return reply.send(orchestrator.getStatus());
});

fastify.get('/health', async (_request, reply) => {
  return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
});

fastify.post<{ Body: { service: string } }>('/debug', async (request, reply) => {
  const { service } = request.body as { service: string };
  if (!service) return reply.status(400).send({ error: 'service required' });
  const report = await orchestrator.triggerDebug(service);
  return reply.send(report);
});

async function main(): Promise<void> {
  orchestrator.start();

  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  fastify.log.info(`Agents status server running on port ${PORT}`);

  const shutdown = async () => {
    orchestrator.stop();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
