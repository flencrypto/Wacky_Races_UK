import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const CreateCarSchema = z.object({
  name: z.string().min(1),
  number: z.number().int().min(1),
  driverName: z.string().min(1),
  imageUrl: z.string().url().optional(),
  status: z.enum(['STAGING', 'ENROUTE', 'PAUSED', 'FINISHED', 'DNF']).optional(),
});

const carsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/v1/events/:id/cars', async (request, reply) => {
    const cars = await prisma.car.findMany({
      where: { eventId: request.params.id },
      include: {
        positions: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });
    return reply.send(cars);
  });

  fastify.get<{ Params: { id: string; carId: string } }>(
    '/v1/events/:id/cars/:carId',
    async (request, reply) => {
      const car = await prisma.car.findFirst({
        where: { id: request.params.carId, eventId: request.params.id },
      });
      if (!car) return reply.status(404).send({ error: 'Car not found' });
      return reply.send(car);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/v1/events/:id/cars',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.jwtUser!;
      if (user.role !== 'ORGANIZER') return reply.status(403).send({ error: 'Forbidden' });

      const body = CreateCarSchema.parse(request.body);
      const car = await prisma.car.create({
        data: { ...body, eventId: request.params.id },
      });
      return reply.status(201).send(car);
    },
  );

  fastify.patch<{ Params: { id: string; carId: string } }>(
    '/v1/events/:id/cars/:carId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.jwtUser!;
      if (user.role !== 'ORGANIZER') return reply.status(403).send({ error: 'Forbidden' });

      const body = CreateCarSchema.partial().parse(request.body);
      const car = await prisma.car.update({
        where: { id: request.params.carId },
        data: body,
      });
      return reply.send(car);
    },
  );

  fastify.delete<{ Params: { id: string; carId: string } }>(
    '/v1/events/:id/cars/:carId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.jwtUser!;
      if (user.role !== 'ORGANIZER') return reply.status(403).send({ error: 'Forbidden' });
      await prisma.car.delete({ where: { id: request.params.carId } });
      return reply.status(204).send();
    },
  );
};

export default carsRoutes;
