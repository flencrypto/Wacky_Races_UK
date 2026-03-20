import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { redisPub } from '../lib/redis';

const CreatePostSchema = z.object({
  content: z.string().min(1).max(1000),
  carId: z.string().optional(),
  mediaUrl: z.string().url().optional(),
});

const feedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { id: string };
    Querystring: { cursor?: string; limit?: string };
  }>('/v1/events/:id/feed', async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit ?? '20'), 50);
    const where: Record<string, unknown> = { eventId: request.params.id };

    if (request.query.cursor) {
      where.createdAt = { lt: new Date(request.query.cursor) };
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { car: { select: { name: true, number: true } } },
    });

    const nextCursor =
      posts.length === limit ? posts[posts.length - 1].createdAt.toISOString() : null;
    return reply.send({ posts, nextCursor });
  });

  fastify.post<{ Params: { id: string } }>(
    '/v1/events/:id/feed',
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const user = request.jwtUser!;
      const body = CreatePostSchema.parse(request.body);

      const post = await prisma.post.create({
        data: {
          eventId: request.params.id,
          carId: body.carId,
          authorId: user.sub,
          content: body.content,
          mediaUrl: body.mediaUrl,
        },
        include: { car: { select: { name: true, number: true } } },
      });

      await redisPub.publish(
        'feed_update',
        JSON.stringify({
          type: 'post',
          eventId: request.params.id,
          post,
        }),
      );

      return reply.status(201).send(post);
    },
  );

  fastify.post<{ Params: { id: string; postId: string } }>(
    '/v1/events/:id/feed/:postId/heart',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const post = await prisma.post.update({
        where: { id: request.params.postId },
        data: { hearts: { increment: 1 } },
      });
      return reply.send(post);
    },
  );
};

export default feedRoutes;
