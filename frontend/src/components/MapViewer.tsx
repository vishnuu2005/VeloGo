import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapViewerProps {
  pickup?: { lat: number; lng: number; address?: string };
  destination?: { lat: number; lng: number; address?: string };
  captainLocation?: { lat: number; lng: number };
  onMapClick?: (lat: number, lng: number) => void;
  selectionMode?: 'pickup' | 'destination' | null;
  className?: string;
  zoom?: number;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  pickup,
  destination,
  captainLocation,
  onMapClick,
  selectionMode,
  className = 'h-[400px] w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200',
  zoom = 13,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{
    pickup?: L.Marker;
    dest?: L.Marker;
    captain?: L.Marker;
    routeLine?: L.Polyline;
  }>({});

  // Helper icons using divIcon with custom SVG
  const createPinIcon = (color: string, label: string) => {
    return L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
          <div style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); white-space: nowrap; margin-bottom: 2px;">
            ${label}
          </div>
          <div style="width: 24px; height: 24px; background-color: ${color}; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
        </div>
      `,
      iconSize: [24, 40],
      iconAnchor: [12, 40],
    });
  };

  const createCaptainIcon = () => {
    return L.divIcon({
      className: 'custom-captain-pin',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
          <div style="width: 38px; height: 38px; background: #0f172a; border: 3px solid #f59e0b; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(245, 158, 11, 0.6); animation: pulse 2s infinite;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultLat = pickup?.lat || 12.9716;
    const defaultLng = pickup?.lng || 77.5946;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([defaultLat, defaultLng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | VeloGo',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Pickup Marker
    if (pickup?.lat && pickup?.lng) {
      if (markersRef.current.pickup) {
        markersRef.current.pickup.setLatLng([pickup.lat, pickup.lng]);
      } else {
        markersRef.current.pickup = L.marker([pickup.lat, pickup.lng], {
          icon: createPinIcon('#10b981', 'Pickup'),
        }).addTo(map);
      }
    } else if (markersRef.current.pickup) {
      map.removeLayer(markersRef.current.pickup);
      delete markersRef.current.pickup;
    }

    // 2. Destination Marker
    if (destination?.lat && destination?.lng) {
      if (markersRef.current.dest) {
        markersRef.current.dest.setLatLng([destination.lat, destination.lng]);
      } else {
        markersRef.current.dest = L.marker([destination.lat, destination.lng], {
          icon: createPinIcon('#ef4444', 'Drop-off'),
        }).addTo(map);
      }
    } else if (markersRef.current.dest) {
      map.removeLayer(markersRef.current.dest);
      delete markersRef.current.dest;
    }

    // 3. Captain Marker
    if (captainLocation?.lat && captainLocation?.lng) {
      if (markersRef.current.captain) {
        markersRef.current.captain.setLatLng([captainLocation.lat, captainLocation.lng]);
      } else {
        markersRef.current.captain = L.marker([captainLocation.lat, captainLocation.lng], {
          icon: createCaptainIcon(),
        }).addTo(map);
      }
    } else if (markersRef.current.captain) {
      map.removeLayer(markersRef.current.captain);
      delete markersRef.current.captain;
    }

    // 4. Draw route line if both pickup & destination exist
    if (pickup?.lat && pickup?.lng && destination?.lat && destination?.lng) {
      const latlngs: [number, number][] = [
        [pickup.lat, pickup.lng],
        // mid curvature point for visual road curve
        [
          (pickup.lat + destination.lat) / 2 + 0.003,
          (pickup.lng + destination.lng) / 2 - 0.003,
        ],
        [destination.lat, destination.lng],
      ];

      if (markersRef.current.routeLine) {
        markersRef.current.routeLine.setLatLngs(latlngs);
      } else {
        markersRef.current.routeLine = L.polyline(latlngs, {
          color: '#f59e0b',
          weight: 5,
          opacity: 0.85,
          dashArray: '8, 6',
        }).addTo(map);
      }

      // Auto fit bounds
      const bounds = L.latLngBounds([
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng],
        ...(captainLocation ? [[captainLocation.lat, captainLocation.lng] as [number, number]] : []),
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (markersRef.current.routeLine) {
      map.removeLayer(markersRef.current.routeLine);
      delete markersRef.current.routeLine;
    } else if (pickup?.lat && pickup?.lng) {
      map.panTo([pickup.lat, pickup.lng]);
    }
  }, [pickup, destination, captainLocation]);

  return (
    <div className="relative">
      <div ref={mapContainerRef} className={className} />
      {selectionMode && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[400] bg-navy-900/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur flex items-center gap-2 border border-slate-700 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping" />
          Click anywhere on map to set {selectionMode === 'pickup' ? 'Pickup Location' : 'Destination'}
        </div>
      )}
    </div>
  );
};
