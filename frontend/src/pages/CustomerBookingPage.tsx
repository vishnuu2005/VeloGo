import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import {
  FareEstimateResponse,
  Ride,
  VehicleCategory,
  PaymentMethod,
} from '../types';
import { MapViewer } from '../components/MapViewer';
import { FareCard } from '../components/FareCard';
import { RideStatusModal } from '../components/RideStatusModal';
import {
  MapPin,
  Tag,
  CreditCard,
  Banknote,
  ArrowRight,
  Crosshair,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import { AddressAutocomplete } from '../components/AddressAutocomplete';

const PRESET_LOCATIONS = [
  { name: 'MG Road Metro Station', lat: 12.9756, lng: 77.6066 },
  { name: 'Koramangala 5th Block', lat: 12.9352, lng: 77.6245 },
  { name: 'Indiranagar 100ft Road', lat: 12.9785, lng: 77.6408 },
  { name: 'Majestic Bus Terminal', lat: 12.9784, lng: 77.5726 },
  { name: 'Electronic City Phase 1', lat: 12.8452, lng: 77.6602 },
  { name: 'Whitefield ITPL', lat: 12.9866, lng: 77.7381 },
  { name: 'Kempegowda Airport', lat: 13.1986, lng: 77.7066 },
];

export const CustomerBookingPage: React.FC = () => {
  const { user } = useAuth();
  const { subscribeToRide } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  // Coordinates & addresses
  const [pickup, setPickup] = useState({
    address: 'MG Road Metro Station, Bengaluru',
    lat: 12.9756,
    lng: 77.6066,
  });
  const [destination, setDestination] = useState({
    address: 'Koramangala 5th Block, Bengaluru',
    lat: 12.9352,
    lng: 77.6245,
  });

  const [selectionMode, setSelectionMode] = useState<'pickup' | 'destination' | null>(null);

  // Estimates & Category selection
  const [estimates, setEstimates] = useState<FareEstimateResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>('BIKE');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('RAZORPAY');

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  // Active ride state
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [captainLocation, setCaptainLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);

  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse query params if redirected from landing page & auto-geocode if coordinates missing
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pAddr = params.get('pickup');
    const dAddr = params.get('dest');
    const pLat = params.get('pLat');
    const pLng = params.get('pLng');
    const dLat = params.get('dLat');
    const dLng = params.get('dLng');
    const cat = params.get('cat') as VehicleCategory | null;

    if (pLat && pLng) {
      setPickup({
        address: pAddr || 'Pickup Point',
        lat: parseFloat(pLat),
        lng: parseFloat(pLng),
      });
    } else if (pAddr) {
      setPickup((prev) => ({ ...prev, address: pAddr }));
      api.geo.search(pAddr).then((results) => {
        if (results && results.length > 0) {
          setPickup({
            address: results[0].displayName || pAddr,
            lat: results[0].latitude,
            lng: results[0].longitude,
          });
        }
      }).catch(() => {});
    }

    if (dLat && dLng) {
      setDestination({
        address: dAddr || 'Destination Point',
        lat: parseFloat(dLat),
        lng: parseFloat(dLng),
      });
    } else if (dAddr) {
      setDestination((prev) => ({ ...prev, address: dAddr }));
      api.geo.search(dAddr).then((results) => {
        if (results && results.length > 0) {
          setDestination({
            address: results[0].displayName || dAddr,
            lat: results[0].latitude,
            lng: results[0].longitude,
          });
        }
      }).catch(() => {});
    }

    if (cat && ['BIKE', 'AUTO', 'CAB'].includes(cat)) {
      setSelectedCategory(cat);
    }
  }, [location.search]);

  // Check if customer already has active ride on load
  useEffect(() => {
    if (user) {
      api.customer
        .getActiveRide()
        .then((ride) => {
          if (ride && ride.status !== 'CANCELLED') {
            setActiveRide(ride);
            if (ride.pickupLat && ride.pickupLng) {
              setPickup({
                address: ride.pickupAddress || 'Pickup Point',
                lat: ride.pickupLat,
                lng: ride.pickupLng,
              });
            }
            if (ride.destLat && ride.destLng) {
              setDestination({
                address: ride.destAddress || 'Destination',
                lat: ride.destLat,
                lng: ride.destLng,
              });
            }
            if (ride.captainCurrentLat && ride.captainCurrentLng) {
              setCaptainLocation({
                lat: ride.captainCurrentLat,
                lng: ride.captainCurrentLng,
              });
            }
          }
        })
        .catch(() => {});
    }
  }, [user]);

  // Subscribe to real-time WebSocket ride updates
  useEffect(() => {
    if (!activeRide) return;

    const unsubscribe = subscribeToRide(
      activeRide.id,
      (updatedRide) => {
        setActiveRide(updatedRide);
        if (updatedRide.captainCurrentLat && updatedRide.captainCurrentLng) {
          setCaptainLocation({
            lat: updatedRide.captainCurrentLat,
            lng: updatedRide.captainCurrentLng,
          });
        }
      },
      (loc) => {
        if (loc.latitude && loc.longitude) {
          setCaptainLocation({ lat: loc.latitude, lng: loc.longitude });
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeRide?.id]);

  // Fetch Fare Estimates whenever coordinates or coupon change
  const fetchEstimates = async () => {
    if (!pickup.lat || !destination.lat) return;
    setIsLoadingEstimate(true);
    setErrorMessage(null);
    try {
      const res = await api.rides.estimate({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: pickup.address,
        destLat: destination.lat,
        destLng: destination.lng,
        destAddress: destination.address,
        couponCode: appliedCoupon || undefined,
      });
      setEstimates(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not calculate fare estimate');
    } finally {
      setIsLoadingEstimate(false);
    }
  };

  useEffect(() => {
    if (activeRide) {
      api.rides
        .estimate({
          pickupLat: activeRide.pickupLat,
          pickupLng: activeRide.pickupLng,
          pickupAddress: activeRide.pickupAddress,
          destLat: activeRide.destLat,
          destLng: activeRide.destLng,
          destAddress: activeRide.destAddress,
        })
        .then(setEstimates)
        .catch(() => {});
    } else {
      fetchEstimates();
    }
  }, [pickup.lat, pickup.lng, destination.lat, destination.lng, appliedCoupon, activeRide]);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.trim()) {
      setAppliedCoupon(couponCode.trim().toUpperCase());
    }
  };

  // Called when user drags green pickup pin or clicks to set pickup on map
  const handleMapPickupChange = async (loc: { lat: number; lng: number; address?: string }) => {
    try {
      const rev = await api.geo.reverse(loc.lat, loc.lng);
      setPickup({
        lat: loc.lat,
        lng: loc.lng,
        address: rev.displayName || `Location (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`,
      });
    } catch {
      setPickup({
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address || `Location (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`,
      });
    }
    setSelectionMode(null);
  };

  // Called when user drags red destination pin or clicks to set destination on map
  const handleMapDestChange = async (loc: { lat: number; lng: number; address?: string }) => {
    try {
      const rev = await api.geo.reverse(loc.lat, loc.lng);
      setDestination({
        lat: loc.lat,
        lng: loc.lng,
        address: rev.displayName || `Location (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`,
      });
    } catch {
      setDestination({
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address || `Location (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`,
      });
    }
    setSelectionMode(null);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (selectionMode === 'pickup') {
      await handleMapPickupChange({ lat, lng });
    } else if (selectionMode === 'destination') {
      await handleMapDestChange({ lat, lng });
    }
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLocation({ lat, lng });
        await handleMapPickupChange({ lat, lng });
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation lookup failed:', err);
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleBookRide = async () => {
    if (!user) {
      navigate('/login?redirect=/book');
      return;
    }

    setIsBooking(true);
    setErrorMessage(null);
    try {
      const ride = await api.rides.book({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: pickup.address,
        destLat: destination.lat,
        destLng: destination.lng,
        destAddress: destination.address,
        vehicleCategory: selectedCategory,
        paymentMethod,
        couponCode: appliedCoupon || undefined,
      });

      setActiveRide(ride);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ride booking failed');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Map Viewer */}
        <div className="lg:col-span-7 order-2 lg:order-1 space-y-4">
          <div className="bg-white rounded-3xl p-3 shadow-sm border border-slate-200 relative overflow-hidden h-[540px] lg:h-[650px] min-h-[480px]">
            <MapViewer
              pickup={
                activeRide
                  ? {
                      lat: activeRide.pickupLat,
                      lng: activeRide.pickupLng,
                      address: activeRide.pickupAddress,
                    }
                  : pickup
              }
              destination={
                activeRide
                  ? {
                      lat: activeRide.destLat,
                      lng: activeRide.destLng,
                      address: activeRide.destAddress,
                    }
                  : destination
              }
              routeGeometry={estimates?.routeGeometry}
              routeDistanceKm={activeRide ? activeRide.distanceKm : estimates?.distanceKm}
              routeDurationMins={activeRide ? activeRide.durationMinutes : estimates?.durationMinutes}
              captainLocation={captainLocation}
              currentLocation={currentLocation}
              selectionMode={activeRide ? null : selectionMode}
              onSelectionModeChange={activeRide ? undefined : setSelectionMode}
              onMapClick={activeRide ? undefined : handleMapClick}
              onPickupChange={activeRide ? undefined : handleMapPickupChange}
              onDestinationChange={activeRide ? undefined : handleMapDestChange}
              onLocateUser={handleLocateUser}
              isLocating={isLocating}
              interactiveSelectionPopup={!activeRide}
              showPinControls={!activeRide}
              className="h-full w-full rounded-2xl"
            />
          </div>

          {/* Quick presets bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Popular Spots:
            </span>
            {PRESET_LOCATIONS.map((spot) => (
              <button
                key={spot.name}
                type="button"
                onClick={() =>
                  setDestination({
                    lat: spot.lat,
                    lng: spot.lng,
                    address: spot.name + ', Bengaluru',
                  })
                }
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-brand-100 hover:text-brand-900 text-slate-700 transition-colors"
              >
                {spot.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Booking Panel or Active Ride Tracker */}
        <div className="lg:col-span-5 order-1 lg:order-2 space-y-6">
          {activeRide ? (
            <RideStatusModal
              ride={activeRide}
              onRideCancelled={() => {
                setActiveRide(null);
                setCaptainLocation(undefined);
              }}
              onPaymentCompleted={() => {
                // Refresh active ride
                api.rides.getById(activeRide.id).then(setActiveRide);
              }}
            />
          ) : (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Book a Ride</h2>
                  <p className="text-xs text-slate-500">Fast, reliable rides at transparent rates</p>
                </div>
                {isLoadingEstimate && (
                  <RefreshCw className="w-4 h-4 text-brand-600 animate-spin" />
                )}
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Locations Input with AddressAutocomplete */}
              <div className="space-y-4">
                <AddressAutocomplete
                  label="Pickup Location"
                  placeholder="Search pickup point or use current location..."
                  value={pickup.address}
                  onAddressChange={(address) => setPickup((prev) => ({ ...prev, address }))}
                  onSelectLocation={(loc) =>
                    setPickup({ address: loc.address, lat: loc.lat, lng: loc.lng })
                  }
                  userLat={pickup.lat}
                  userLng={pickup.lng}
                  onUseCurrentLocation={handleLocateUser}
                  isLocating={isLocating}
                  markerColor="bg-emerald-500"
                  pinButton={
                    <button
                      type="button"
                      onClick={() =>
                        setSelectionMode((prev) => (prev === 'pickup' ? null : 'pickup'))
                      }
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 ${
                        selectionMode === 'pickup'
                          ? 'bg-emerald-600 text-white'
                          : 'text-brand-700 hover:underline'
                      }`}
                    >
                      <Crosshair className="w-3 h-3" /> Pin on map
                    </button>
                  }
                />

                <AddressAutocomplete
                  label="Destination"
                  placeholder="Search destination..."
                  value={destination.address}
                  onAddressChange={(address) => setDestination((prev) => ({ ...prev, address }))}
                  onSelectLocation={(loc) =>
                    setDestination({ address: loc.address, lat: loc.lat, lng: loc.lng })
                  }
                  userLat={destination.lat}
                  userLng={destination.lng}
                  markerColor="bg-red-500"
                  pinButton={
                    <button
                      type="button"
                      onClick={() =>
                        setSelectionMode((prev) => (prev === 'destination' ? null : 'destination'))
                      }
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 ${
                        selectionMode === 'destination'
                          ? 'bg-red-600 text-white'
                          : 'text-brand-700 hover:underline'
                      }`}
                    >
                      <Crosshair className="w-3 h-3" /> Pin on map
                    </button>
                  }
                />
              </div>

              {/* Distance & Trip Time Banner */}
              {estimates && (
                <div className="p-3.5 bg-brand-50/60 rounded-2xl border border-brand-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛣️</span>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">
                        {estimates.distanceKm} km driving route
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Estimated trip duration ~{estimates.durationMinutes} mins
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-brand-700 bg-white px-2.5 py-1 rounded-xl shadow-sm border border-brand-200">
                    Live Distance
                  </span>
                </div>
              )}

              {/* Ride Categories list */}
              {estimates && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase">Available Rides</h3>
                  <div className="space-y-2.5">
                    {estimates.estimates.map((est) => (
                      <FareCard
                        key={est.category}
                        estimate={est}
                        isSelected={selectedCategory === est.category}
                        onSelect={() => setSelectedCategory(est.category)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Coupon / Promo code */}
              <div>
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Coupon code (e.g. VELO50)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full text-xs font-bold uppercase pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
                  >
                    Apply
                  </button>
                </form>
                {estimates?.couponApplied && (
                  <p className="text-xs font-bold text-emerald-600 mt-1.5 flex items-center gap-1">
                    ✓ Code '{estimates.couponApplied.code}' applied: Save ₹
                    {estimates.couponApplied.discountAmount.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Payment Method toggle */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('RAZORPAY')}
                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                      paymentMethod === 'RAZORPAY'
                        ? 'border-brand-500 bg-brand-50/50 text-slate-950 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-brand-600" />
                    <span>Razorpay (Online)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                      paymentMethod === 'CASH'
                        ? 'border-brand-500 bg-brand-50/50 text-slate-950 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Cash on Trip</span>
                  </button>
                </div>
              </div>

              {/* Book Ride Action */}
              <button
                type="button"
                disabled={isBooking || !estimates}
                onClick={handleBookRide}
                className="w-full bg-brand-500 hover:bg-brand-600 text-slate-950 font-black py-4 px-6 rounded-2xl shadow-glow text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50"
              >
                {isBooking ? 'Dispatching Request...' : 'Confirm & Request Captain'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
