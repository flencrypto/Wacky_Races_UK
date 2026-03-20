import React, { useState } from 'react';
import Header from './widgets/Header';
import OfflineBanner from './widgets/OfflineBanner';
import { LiveMap } from './features/live-map/LiveMap';
import { CarGrid } from './features/cars/CarGrid';
import { RallyFeed } from './features/feed/RallyFeed';

type Tab = 'map' | 'cars' | 'feed';

const DEFAULT_EVENT_ID = (import.meta.env.VITE_DEFAULT_EVENT_ID as string | undefined) ?? '00000000-0000-0000-0000-000000000000';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('map');

  return (
    <div className="min-h-screen bg-racing-black text-white flex flex-col">
      <OfflineBanner />
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-hidden">
        {activeTab === 'map' && <LiveMap eventId={DEFAULT_EVENT_ID} />}
        {activeTab === 'cars' && <CarGrid eventId={DEFAULT_EVENT_ID} />}
        {activeTab === 'feed' && <RallyFeed eventId={DEFAULT_EVENT_ID} />}
      </main>
    </div>
  );
}
