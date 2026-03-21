import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFollowedCars } from '../../hooks/useFollowedCars';
import type { Car } from '../../hooks/useLivePositions';

const STATUS_LABELS: Record<string, string> = {
  STAGING: '⏳ Staging',
  ENROUTE: '🏎 En Route',
  PAUSED: '⏸ Paused',
  FINISHED: '🏁 Finished',
  DNF: '❌ DNF',
};

const STATUS_COLORS: Record<string, string> = {
  ENROUTE: 'text-neon-green',
  STAGING: 'text-yellow-400',
  PAUSED: 'text-orange-400',
  FINISHED: 'text-gray-400',
  DNF: 'text-neon-red',
};

interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const { isFollowed, toggle } = useFollowedCars();
  const followed = isFollowed(car.id);

  const followMutation = useMutation({
    mutationFn: async () => {
      // Follow state is local only; no API call needed
    },
    onMutate: () => {
      toggle(car.id);
    },
    onError: () => {
      toggle(car.id); // revert on error
    },
  });

  return (
    <div
      className={`bg-racing-gray rounded-xl p-4 border transition-all ${
        followed ? 'border-neon-green shadow-[0_0_12px_#39FF14]' : 'border-racing-dark'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-racing-dark flex items-center justify-center text-lg font-bold text-white border border-racing-gray">
            #{car.number}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">{car.name}</h3>
            <p className="text-gray-400 text-xs">{car.driverName}</p>
          </div>
        </div>
        <button
          onClick={() => followMutation.mutate()}
          className={`text-xs px-2 py-1 rounded-full border transition-colors ${
            followed
              ? 'border-neon-green text-neon-green bg-neon-green/10'
              : 'border-gray-600 text-gray-400 hover:border-gray-400'
          }`}
        >
          {followed ? '★ Following' : '☆ Follow'}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className={`text-xs font-medium ${STATUS_COLORS[car.status] ?? 'text-gray-400'}`}>
          {STATUS_LABELS[car.status] ?? car.status}
        </span>
        {car.speed !== undefined && (
          <span className="text-xs text-gray-400">{Math.round(car.speed)} km/h</span>
        )}
      </div>
    </div>
  );
}
