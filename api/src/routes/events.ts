import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const CreateEventSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  active: z.boolean().optional().default(false),
});

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/v1/events', async (_request, reply) => {
    const events = await prisma.event.findMany({
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { cars: true, posts: true } } },
    });
    return reply.send(events);
  });

  fastify.get<{ Params: { id: string } }>('/v1/events/:id', async (request, reply) => {
    const event = await prisma.event.findUnique({
      where: { id: request.params.id },
      include: { cars: true, _count: { select: { posts: true } } },
    });
    if (!event) return reply.status(404).send({ error: 'Event not found' });
    return reply.send(event);
  });

  fastify.post('/v1/events', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.jwtUser!;
    if (user.role !== 'ORGANIZER') return reply.status(403).send({ error: 'Forbidden' });

    const body = CreateEventSchema.parse(request.body);
    const event = await prisma.event.create({
      data: {
        name: body.name,
        description: body.description,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        active: body.active,
      },
    });
    return reply.status(201).send(event);
  });

  fastify.patch<{ Params: { id: string } }>(
    '/v1/events/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.jwtUser!;
      if (user.role !== 'ORGANIZER') return reply.status(403).send({ error: 'Forbidden' });

      const body = CreateEventSchema.partial().parse(request.body);
      const data: Record<string, unknown> = {};
      if (body.name) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.startDate) data.startDate = new Date(body.startDate);
      if (body.endDate) data.endDate = new Date(body.endDate);
      if (body.active !== undefined) data.active = body.active;

      const event = await prisma.event.update({ where: { id: request.params.id }, data });
      return reply.send(event);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/v1/events/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.jwtUser!;
      if (user.role !== 'ORGANIZER') return reply.status(403).send({ error: 'Forbidden' });
      await prisma.event.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    },
  );
};

export default eventsRoutes;
