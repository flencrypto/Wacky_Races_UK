import React, { useCallback, useEffect, useRef, useState } from 'react';
import MapGL, { Layer, Marker, Source } from 'react-map-gl/maplibre';
import { useMotionValue, animate } from 'framer-motion';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useLivePositions, type Car } from '../../hooks/useLivePositions';
import { useFollowedCars } from '../../hooks/useFollowedCars';
import CarMarker from './CarMarker';
import MapControls from './MapControls';

const MAP_STYLE =
  (import.meta.env.VITE_MAP_STYLE_URL as string | undefined) ??
  'https://demotiles.maplibre.org/style.json';
const TRAIL_MAX_POINTS = 30;
const PAUSED_CLEAR_MS = 10 * 60 * 1000;

interface TrailPoint {
  lat: number;
  lng: number;
  ts: number;
}

function useSmoothPosition(targetLng: number, targetLat: number, carId: string) {
  const smoothLng = useMotionValue(targetLng);
  const smoothLat = useMotionValue(targetLat);
  const prevId = useRef(carId);

  useEffect(() => {
    if (prevId.current !== carId) {
      smoothLng.set(targetLng);
      smoothLat.set(targetLat);
      prevId.current = carId;
      return;
    }
    const animLng = animate(smoothLng, targetLng, { duration: 1.5, ease: 'linear' });
    const animLat = animate(smoothLat, targetLat, { duration: 1.5, ease: 'linear' });
    return () => {
      animLng.stop();
      animLat.stop();
    };
  }, [targetLng, targetLat, carId, smoothLng, smoothLat]);

  return { smoothLng, smoothLat };
}

interface SmoothedMarkerProps {
  car: Car;
  isFollowed: boolean;
}

function SmoothedMarker({ car, isFollowed }: SmoothedMarkerProps) {
  const lng = car.lng ?? 0;
  const lat = car.lat ?? 0;
  const { smoothLng, smoothLat } = useSmoothPosition(lng, lat, car.id);
  const [lngVal, setLngVal] = useState(lng);
  const [latVal, setLatVal] = useState(lat);

  useEffect(() => {
    return smoothLng.on('change', (v) => setLngVal(v));
  }, [smoothLng]);

  useEffect(() => {
    return smoothLat.on('change', (v) => setLatVal(v));
  }, [smoothLat]);

  return (
    <Marker
      longitude={lngVal}
      latitude={latVal}
      anchor="bottom"
      style={{ zIndex: isFollowed ? 300 : 50 }}
    >
      <CarMarker car={car} isFollowed={isFollowed} />
    </Marker>
  );
}

function useAnimatedTrails(cars: Car[]) {
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const lastUpdateRef = useRef<Map<string, number>>(new Map());
  const carColorsRef = useRef<Record<string, string>>({});

  const getCarColor = useCallback((id: string) => {
    if (carColorsRef.current[id]) return carColorsRef.current[id];
    const hue = parseInt(id.slice(0, 8), 16) % 360;
    const color = `hsl(${hue}, 100%, 65%)`;
    carColorsRef.current[id] = color;
    return color;
  }, []);

  const [trailGeoJSON, setTrailGeoJSON] = useState<GeoJSON.FeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  });

  useEffect(() => {
    const now = Date.now();

    for (const car of cars) {
      if (car.lat === undefined || car.lng === undefined) continue;

      const trail = trailsRef.current.get(car.id) ?? [];
      const lastUpdate = lastUpdateRef.current.get(car.id) ?? 0;

      if (car.status === 'PAUSED' && now - lastUpdate > PAUSED_CLEAR_MS) {
        trailsRef.current.set(car.id, []);
        continue;
      }

      const lastPoint = trail[trail.length - 1];
      if (!lastPoint || lastPoint.lat !== car.lat || lastPoint.lng !== car.lng) {
        trail.push({ lat: car.lat, lng: car.lng, ts: now });
        if (trail.length > TRAIL_MAX_POINTS) trail.shift();
        trailsRef.current.set(car.id, trail);
        lastUpdateRef.current.set(car.id, now);
      }
    }

    const features: GeoJSON.Feature[] = [];
    for (const [carId, trail] of trailsRef.current.entries()) {
      if (trail.length < 2) continue;
      features.push({
        type: 'Feature',
        properties: { carId, color: getCarColor(carId) },
        geometry: {
          type: 'LineString',
          coordinates: trail.map((p) => [p.lng, p.lat]),
        },
      });
    }

    setTrailGeoJSON({ type: 'FeatureCollection', features });
  }, [cars, getCarColor]);

  return trailGeoJSON;
}

interface LiveMapProps {
  eventId: string;
}

export function LiveMap({ eventId }: LiveMapProps) {
  const { data: cars = [], isLoading } = useLivePositions(eventId);
  const { followedIds } = useFollowedCars();
  const [showTrails, setShowTrails] = useState(true);
  const trailGeoJSON = useAnimatedTrails(cars);

  const carsWithPos = cars.filter((c) => c.lat !== undefined && c.lng !== undefined);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-racing-black z-10">
          <div className="text-neon-green animate-pulse text-xl font-bold">Loading map…</div>
        </div>
      )}
      <MapGL
        initialViewState={{
          longitude: -1.5,
          latitude: 52.5,
          zoom: 6,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
      >
        {showTrails && (
          <Source id="trails" type="geojson" data={trailGeoJSON} lineMetrics={true}>
            <Layer
              id="trail-lines"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 3,
                'line-opacity': 0.7,
                'line-gradient': [
                  'interpolate',
                  ['linear'],
                  ['line-progress'],
                  0,
                  'rgba(0,0,0,0)',
                  1,
                  ['get', 'color'],
                ],
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </Source>
        )}

        {carsWithPos.map((car) => (
          <SmoothedMarker
            key={car.id}
            car={car}
            isFollowed={followedIds.has(car.id)}
          />
        ))}
      </MapGL>

      <MapControls
        showTrails={showTrails}
        onToggleTrails={() => setShowTrails((v) => !v)}
      />
    </div>
  );
}
