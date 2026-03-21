import React from 'react';

interface MapControlsProps {
  showTrails: boolean;
  onToggleTrails: () => void;
}

export default function MapControls({ showTrails, onToggleTrails }: MapControlsProps) {
  return (
    <div className="absolute bottom-6 right-4 flex flex-col gap-2 z-10">
      <button
        onClick={onToggleTrails}
        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
          showTrails
            ? 'bg-neon-green/20 border-neon-green text-neon-green'
            : 'bg-racing-dark border-racing-gray text-gray-400'
        }`}
        title="Toggle trails"
      >
        {showTrails ? '🛤 Trails On' : '🛤 Trails Off'}
      </button>
    </div>
  );
}
