import React from 'react';
import { useLivePositions } from '../../hooks/useLivePositions';
import { CarCard } from './CarCard';

interface CarGridProps {
  eventId: string;
}

export function CarGrid({ eventId }: CarGridProps) {
  const { data: cars = [], isLoading, error } = useLivePositions(eventId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neon-green animate-pulse font-bold">Loading cars…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neon-red font-bold">Failed to load cars</div>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-[calc(100vh-4rem)]">
      <h2 className="text-lg font-bold text-white mb-4 neon-text-green">
        🏎 Rally Cars ({cars.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cars.map((car) => (
          <CarCard key={car.id} car={car} />
        ))}
      </div>
      {cars.length === 0 && (
        <div className="text-center text-gray-400 mt-12">No cars registered yet</div>
      )}
    </div>
  );
}
