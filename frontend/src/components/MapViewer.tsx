import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Crosshair, Loader2 } from 'lucide-react';

interface MapViewerProps {
  pickup?: { lat: number; lng: number; address?: string };
  destination?: { lat: number; lng: number; address?: string };
  captainLocation?: { lat: number; lng: number };
  currentLocation?: { lat: number; lng: number };
  routeGeometry?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
  selectionMode?: 'pickup' | 'destination' | null;
  onLocateUser?: () => void;
  isLocating?: boolean;
  className?: string;
  zoom?: number;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  pickup,
  destination,
  captainLocation,
  currentLocation,
  routeGeometry,
  onMapClick,
  selectionMode,
  onLocateUser,
  isLocating = false,
  className = 'h-[400px] w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200',
  zoom = 14,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{
    currentLoc?: L.Marker;
    currentLocCircle?: L.CircleMarker;
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
        <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: none;">
          <div style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; box-shadow: 0 4px 10px rgba(0,0,0,0.25); white-space: nowrap; margin-bottom: 2px;">
            ${label}
          </div>
          <div style="width: 22px; height: 22px; background-color: ${color}; border: 3px solid white; border-radius: 50%; box-shadow: 0 3px 6px rgba(0,0,0,0.35);"></div>
        </div>
      `,
      iconSize: [24, 40],
      iconAnchor: [12, 40],
    });
  };

  const createCurrentLocationIcon = () => {
    return L.divIcon({
      className: 'custom-current-location',
      html: `
        <div style="position: relative; width: 24px; height: 24px; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 24px; height: 24px; background: rgba(59, 130, 246, 0.35); border-radius: 50%; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 14px; height: 14px; background: #2563eb; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  const createCaptainIcon = () => {
    return L.divIcon({
      className: 'custom-captain-pin',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
          <div style="width: 38px; height: 38px; background: #0f172a; border: 3px solid #f59e0b; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(245, 158, 11, 0.7); animation: pulse 2s infinite;">
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

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use current location or pickup or fallback to default center
    const initialLat = currentLocation?.lat || pickup?.lat || 20.5937;
    const initialLng = currentLocation?.lng || pickup?.lng || 78.9629;
    const initialZoom = (currentLocation || pickup) ? zoom : 5;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([initialLat, initialLng], initialZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | VeloGo',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    });

    mapInstanceRef.current = map;

    // Resize observer to ensure tiles never render blank on responsive resizing
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers and Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Current Location Marker
    if (currentLocation?.lat && currentLocation?.lng) {
      if (markersRef.current.currentLoc) {
        markersRef.current.currentLoc.setLatLng([currentLocation.lat, currentLocation.lng]);
      } else {
        markersRef.current.currentLoc = L.marker([currentLocation.lat, currentLocation.lng], {
          icon: createCurrentLocationIcon(),
          zIndexOffset: 50,
        }).addTo(map);
      }
    } else if (markersRef.current.currentLoc) {
      map.removeLayer(markersRef.current.currentLoc);
      delete markersRef.current.currentLoc;
    }

    // 2. Pickup Marker
    if (pickup?.lat && pickup?.lng) {
      if (markersRef.current.pickup) {
        markersRef.current.pickup.setLatLng([pickup.lat, pickup.lng]);
      } else {
        markersRef.current.pickup = L.marker([pickup.lat, pickup.lng], {
          icon: createPinIcon('#10b981', 'Pickup'),
          zIndexOffset: 100,
        }).addTo(map);
      }
    } else if (markersRef.current.pickup) {
      map.removeLayer(markersRef.current.pickup);
      delete markersRef.current.pickup;
    }

    // 3. Destination Marker
    if (destination?.lat && destination?.lng) {
      if (markersRef.current.dest) {
        markersRef.current.dest.setLatLng([destination.lat, destination.lng]);
      } else {
        markersRef.current.dest = L.marker([destination.lat, destination.lng], {
          icon: createPinIcon('#ef4444', 'Drop-off'),
          zIndexOffset: 100,
        }).addTo(map);
      }
    } else if (markersRef.current.dest) {
      map.removeLayer(markersRef.current.dest);
      delete markersRef.current.dest;
    }

    // 4. Captain Marker
    if (captainLocation?.lat && captainLocation?.lng) {
      if (markersRef.current.captain) {
        markersRef.current.captain.setLatLng([captainLocation.lat, captainLocation.lng]);
      } else {
        markersRef.current.captain = L.marker([captainLocation.lat, captainLocation.lng], {
          icon: createCaptainIcon(),
          zIndexOffset: 150,
        }).addTo(map);
      }
    } else if (markersRef.current.captain) {
      map.removeLayer(markersRef.current.captain);
      delete markersRef.current.captain;
    }

    // 5. Draw Road Route Line
    if (pickup?.lat && pickup?.lng && destination?.lat && destination?.lng) {
      // Use real road geometry if available, else 2-point fallback
      const pts: [number, number][] = (routeGeometry && routeGeometry.length > 0)
        ? routeGeometry
        : [
            [pickup.lat, pickup.lng],
            [destination.lat, destination.lng],
          ];

      if (markersRef.current.routeLine) {
        markersRef.current.routeLine.setLatLngs(pts);
      } else {
        markersRef.current.routeLine = L.polyline(pts, {
          color: '#f59e0b',
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
        }).addTo(map);
      }

      // Auto fit bounds
      const bounds = L.latLngBounds(pts);
      if (captainLocation?.lat && captainLocation?.lng) {
        bounds.extend([captainLocation.lat, captainLocation.lng]);
      }
      map.fitBounds(bounds, { padding: [55, 55], maxZoom: 16 });
    } else {
      if (markersRef.current.routeLine) {
        map.removeLayer(markersRef.current.routeLine);
        delete markersRef.current.routeLine;
      }
      // If only pickup is available, smoothly pan to it
      if (pickup?.lat && pickup?.lng) {
        map.panTo([pickup.lat, pickup.lng]);
        if (map.getZoom() < 13) {
          map.setZoom(14);
        }
      } else if (currentLocation?.lat && currentLocation?.lng && !destination?.lat) {
        map.panTo([currentLocation.lat, currentLocation.lng]);
        if (map.getZoom() < 13) {
          map.setZoom(14);
        }
      }
    }
  }, [pickup, destination, captainLocation, currentLocation, routeGeometry]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className={className} />

      {/* Floating Mode Tooltip */}
      {selectionMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[400] bg-slate-900/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl backdrop-blur-md flex items-center gap-2 border border-slate-700 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping" />
          Click anywhere on map to set {selectionMode === 'pickup' ? 'Pickup Location' : 'Destination'}
        </div>
      )}

      {/* Locate Me Floating Button */}
      {onLocateUser && (
        <button
          type="button"
          onClick={onLocateUser}
          disabled={isLocating}
          title="Locate my position"
          aria-label="Locate my position"
          className="absolute bottom-5 right-5 z-[400] bg-white/95 hover:bg-white text-slate-800 hover:text-brand-600 p-3 rounded-2xl shadow-xl border border-slate-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
          ) : (
            <Crosshair className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  );
};
