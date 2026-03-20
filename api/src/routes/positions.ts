import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { redisPub, redis } from '../lib/redis';

const PostPositionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().optional(),
  heading: z.number().min(0).max(359).optional(),
  altitude: z.number().optional(),
  accuracy: z.number().optional(),
  timestamp: z.string().datetime().optional(),
});

// Blur position by ~400m (roughly 0.004 degrees)
function blurPosition(lat: number, lng: number): { lat: number; lng: number } {
  const noise = 0.004;
  return {
    lat: lat + (Math.random() - 0.5) * noise * 2,
    lng: lng + (Math.random() - 0.5) * noise * 2,
  };
}

const positionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string; carId: string } }>(
    '/v1/events/:id/cars/:carId/positions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.jwtUser!;
      if (user.role === 'FAN') return reply.status(403).send({ error: 'Forbidden' });

      const body = PostPositionSchema.parse(request.body);
      const car = await prisma.car.findFirst({
        where: { id: request.params.carId, eventId: request.params.id },
      });
      if (!car) return reply.status(404).send({ error: 'Car not found' });

      const position = await prisma.position.create({
        data: {
          carId: request.params.carId,
          lat: body.lat,
          lng: body.lng,
          speed: body.speed,
          heading: body.heading,
          altitude: body.altitude,
          accuracy: body.accuracy,
          rawLat: body.lat,
          rawLng: body.lng,
          timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
        },
      });

      // Push raw position to processor queue
      await redis.lpush(
        'positions:raw',
        JSON.stringify({
          positionId: position.id,
          carId: request.params.carId,
          eventId: request.params.id,
          lat: body.lat,
          lng: body.lng,
          speed: body.speed,
          heading: body.heading,
          timestamp: position.timestamp,
        }),
      );

      // Publish to pub/sub for WebSocket broadcast
      await redisPub.publish(
        'position_update',
        JSON.stringify({
          type: 'position',
          carId: request.params.carId,
          eventId: request.params.id,
          lat: body.lat,
          lng: body.lng,
          speed: body.speed,
          heading: body.heading,
          timestamp: position.timestamp,
        }),
      );

      return reply.status(201).send(position);
    },
  );

  fastify.get<{
    Params: { id: string; carId: string };
    Querystring: { limit?: string; before?: string };
  }>(
    '/v1/events/:id/cars/:carId/positions',
    { preHandler: [fastify.authenticateOptional] },
    async (request, reply) => {
      const user = request.jwtUser;
      const limit = Math.min(parseInt(request.query.limit ?? '50'), 200);

      const where: Record<string, unknown> = { carId: request.params.carId };

      // FAN role: delay 10 minutes
      if (!user || user.role === 'FAN') {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        where.timestamp = { lte: tenMinutesAgo };
      }

      if (request.query.before) {
        const existing = where.timestamp as Record<string, unknown> | undefined;
        where.timestamp = { ...(existing ?? {}), lt: new Date(request.query.before) };
      }

      const positions = await prisma.position.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      // Apply blur for FAN role
      const result = positions.map((pos) => {
        if (!user || user.role === 'FAN') {
          const blurred = blurPosition(pos.lat, pos.lng);
          return { ...pos, lat: blurred.lat, lng: blurred.lng, rawLat: undefined, rawLng: undefined };
        }
        return pos;
      });

      return reply.send(result);
    },
  );
};

export default positionsRoutes;
