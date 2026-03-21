import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { wsSubscribe } from '../lib/ws';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export interface Car {
  id: string;
  name: string;
  number: number;
  driverName: string;
  imageUrl?: string;
  status: string;
  lat?: number;
  lng?: number;
  speed?: number;
  heading?: number;
  eventId: string;
}

interface Position {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  carId: string;
  eventId: string;
}

async function fetchCars(eventId: string): Promise<Car[]> {
  const res = await fetch(`${API_URL}/v1/events/${eventId}/cars`);
  if (!res.ok) throw new Error('Failed to fetch cars');
  const cars = (await res.json()) as Array<Car & { positions?: Position[] }>;

  return cars.map((car) => {
    const latestPos = car.positions?.[0];
    return {
      ...car,
      lat: latestPos?.lat,
      lng: latestPos?.lng,
      speed: latestPos?.speed,
      heading: latestPos?.heading,
    };
  });
}

export function useLivePositions(eventId: string) {
  const queryClient = useQueryClient();
  const unsubRef = useRef<(() => void) | null>(null);

  const query = useQuery({
    queryKey: ['cars', eventId],
    queryFn: () => fetchCars(eventId),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const unsub = wsSubscribe(`event:${eventId}`, (data) => {
      const pos = data as Position;
      if (pos.carId && pos.lat !== undefined && pos.lng !== undefined) {
        queryClient.setQueryData<Car[]>(['cars', eventId], (old) => {
          if (!old) return old;
          return old.map((car) =>
            car.id === pos.carId
              ? { ...car, lat: pos.lat, lng: pos.lng, speed: pos.speed, heading: pos.heading }
              : car
          );
        });
      }
    });

    unsubRef.current = unsub;
    return () => {
      unsubRef.current?.();
    };
  }, [eventId, queryClient]);

  return query;
}
