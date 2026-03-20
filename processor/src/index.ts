import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { z } from 'zod';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/wackraces';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const prisma = new PrismaClient();
const redisConsumer = new Redis(REDIS_URL);
const redisPub = new Redis(REDIS_URL);

const RAW_QUEUE = 'positions:raw';
const POSITION_CHANNEL = 'position_update';
// Max speed filter: 300 km/h ≈ 83.33 m/s — rounded up slightly to avoid false positives
const MAX_SPEED_MS = 83.34;
// Minimum time delta to prevent division by near-zero values causing false outlier detection
const MIN_DT_SECONDS = 0.1;

const RawPositionSchema = z.object({
  positionId: z.string(),
  carId: z.string(),
  eventId: z.string(),
  lat: z.number(),
  lng: z.number(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  timestamp: z.string().or(z.date()),
});

type RawPosition = z.infer<typeof RawPositionSchema>;

// Cache last known positions for outlier detection
const lastPositions = new Map<string, { lat: number; lng: number; ts: number }>();

function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

function clampLng(lng: number): number {
  return Math.max(-180, Math.min(180, lng));
}

// Haversine distance in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sanitize(raw: RawPosition): { lat: number; lng: number; isOutlier: boolean } {
  const lat = clampLat(raw.lat);
  const lng = clampLng(raw.lng);

  const last = lastPositions.get(raw.carId);
  if (last) {
    const ts = new Date(raw.timestamp).getTime();
    const dtSeconds = Math.max((ts - last.ts) / 1000, MIN_DT_SECONDS);
    const distMeters = haversineDistance(last.lat, last.lng, lat, lng);
    const speedMs = distMeters / dtSeconds;

    if (speedMs > MAX_SPEED_MS) {
      console.warn(
        `[Processor] Outlier dropped — positionId=${raw.positionId} carId=${raw.carId} speed=${speedMs.toFixed(1)} m/s`
      );
      return { lat, lng, isOutlier: true };
    }
  }

  lastPositions.set(raw.carId, { lat, lng, ts: new Date(raw.timestamp).getTime() });
  return { lat, lng, isOutlier: false };
}

async function processOne(raw: RawPosition): Promise<void> {
  const { lat, lng, isOutlier } = sanitize(raw);

  if (isOutlier) return; // Drop outlier

  // Update position record with sanitized coords
  await prisma.position.update({
    where: { id: raw.positionId },
    data: { lat, lng },
  });

  // Publish processed update
  await redisPub.publish(
    POSITION_CHANNEL,
    JSON.stringify({
      type: 'position',
      carId: raw.carId,
      eventId: raw.eventId,
      lat,
      lng,
      speed: raw.speed,
      heading: raw.heading,
      timestamp: raw.timestamp,
    })
  );
}

async function consume(): Promise<void> {
  console.log('[Processor] Starting Redis consumer...');

  while (true) {
    try {
      const result = await redisConsumer.blpop(RAW_QUEUE, 5);
      if (!result) continue;

      const [, data] = result;
      const parsed = RawPositionSchema.safeParse(JSON.parse(data));

      if (!parsed.success) {
        console.error('[Processor] Invalid message:', parsed.error.message);
        continue;
      }

      await processOne(parsed.data);
    } catch (err) {
      console.error('[Processor] Error processing message:', err);
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
}

async function main(): Promise<void> {
  await prisma.$connect();
  console.log('[Processor] Connected to database');

  process.on('SIGTERM', async () => {
    console.log('[Processor] Shutting down...');
    await prisma.$disconnect();
    redisConsumer.disconnect();
    redisPub.disconnect();
    process.exit(0);
  });

  await consume();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
