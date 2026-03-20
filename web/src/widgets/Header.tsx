import React, { useEffect, useState } from 'react';

type Tab = 'map' | 'cars' | 'feed';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const RALLY_DATE = new Date('2026-06-22T06:00:00Z');

interface CountdownValues {
  days: number;
  hours: number;
  mins: number;
  secs: number;
}

function useCountdown(target: Date): CountdownValues | null {
  const [remaining, setRemaining] = useState(() => target.getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining <= 0) return null;

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);

  return { days, hours, mins, secs };
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const countdown = useCountdown(RALLY_DATE);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'map', label: '🗺 Map' },
    { id: 'cars', label: '🏎 Cars' },
    { id: 'feed', label: '📡 Feed' },
  ];

  return (
    <header className="bg-racing-dark border-b border-racing-gray sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-neon-green font-black text-lg neon-text-green">
            🏁 WACKY RACES UK
          </span>
          {countdown && (
            <span className="hidden sm:inline text-xs text-gray-400 font-mono">
              T-{countdown.days}d {countdown.hours}h {countdown.mins}m {countdown.secs}s
            </span>
          )}
          {!countdown && (
            <span className="text-xs text-neon-green font-bold animate-pulse">LIVE NOW</span>
          )}
        </div>

        <nav className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-neon-green/20 text-neon-green border border-neon-green/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
