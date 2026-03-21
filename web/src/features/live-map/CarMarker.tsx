import React from 'react';
import { useFollowedCars } from '../../hooks/useFollowedCars';
import type { Car } from '../../hooks/useLivePositions';

interface CarMarkerProps {
  car: Car;
  isFollowed: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  ENROUTE: '#39FF14',
  STAGING: '#FFD700',
  PAUSED: '#FFA500',
  FINISHED: '#888',
  DNF: '#FF073A',
};

export default function CarMarker({ car, isFollowed }: CarMarkerProps) {
  const { toggle } = useFollowedCars();
  const color = STATUS_COLORS[car.status] ?? '#888';

  return (
    <button
      onClick={() => toggle(car.id)}
      className="flex flex-col items-center cursor-pointer group"
      title={`${car.name} - #${car.number} - ${car.driverName}`}
    >
      <div
        className="relative w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white transition-transform group-hover:scale-125"
        style={{
          backgroundColor: color,
          borderColor: isFollowed ? '#fff' : color,
          boxShadow: isFollowed ? `0 0 12px ${color}, 0 0 24px ${color}` : undefined,
        }}
      >
        {car.number}
      </div>
      <div className="mt-1 px-1.5 py-0.5 bg-racing-dark/90 rounded text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
        {car.name}
      </div>
    </button>
  );
}
