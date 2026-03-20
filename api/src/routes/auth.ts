import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import * as jwtLib from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const JWT_REFRESH_SECRET = (() => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_REFRESH_SECRET must be set in production');
    }
    return 'dev-refresh-secret-change-me-32ch';
  }
  return secret;
})();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['FAN', 'PARTICIPANT']).optional().default('FAN'),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

function signRefreshToken(sub: string): string {
  return jwtLib.sign({ sub, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

function verifyRefreshToken(token: string): { sub: string } {
  const payload = jwtLib.verify(token, JWT_REFRESH_SECRET) as { sub: string; type: string };
  if (payload.type !== 'refresh') throw new Error('Not a refresh token');
  return { sub: payload.sub };
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/auth/register', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = RegisterSchema.parse(request.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return reply.status(409).send({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash, role: body.role },
    });

    const token = fastify.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '15m' },
    );
    const refreshToken = signRefreshToken(user.id);

    return reply.status(201).send({
      token,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  });

  fastify.post('/v1/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = LoginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    const token = fastify.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '15m' },
    );
    const refreshToken = signRefreshToken(user.id);

    return reply.send({
      token,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  });

  fastify.post('/v1/auth/refresh', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { refreshToken } = RefreshSchema.parse(request.body);
    try {
      const { sub } = verifyRefreshToken(refreshToken);

      const user = await prisma.user.findUnique({ where: { id: sub } });
      if (!user) return reply.status(401).send({ error: 'User not found' });

      const token = fastify.jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: '15m' },
      );
      const newRefreshToken = signRefreshToken(user.id);

      return reply.send({ token, refreshToken: newRefreshToken });
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });
};

export default authRoutes;
