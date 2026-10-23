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
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import {
  Tag,
  CreditCard,
  Banknote,
  ArrowRight,
  Crosshair,
  AlertCircle,
  RefreshCw,
  Navigation,
  CheckCircle2,
  MapPin,
} from 'lucide-react';

export const CustomerBookingPage: React.FC = () => {
  const { user } = useAuth();
  const { subscribeToRide } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  // User detected device location
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isLocating, setIsLocating] = useState(false);
  const [geoNotice, setGeoNotice] = useState<{ type: 'info' | 'success' | 'warn'; message: string } | null>(null);

  // Pickup and Destination
  const [pickup, setPickup] = useState<{ address: string; lat: number; lng: number }>({
    address: '',
    lat: 0,
    lng: 0,
  });
  const [destination, setDestination] = useState<{ address: string; lat: number; lng: number }>({
    address: '',
    lat: 0,
    lng: 0,
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

  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Geolocation trigger function
  const handleGetLocation = (isInitial = false) => {
    if (!navigator.geolocation) {
      if (!isInitial) {
        setGeoNotice({ type: 'warn', message: 'Geolocation is not supported by your browser.' });
      }
      return;
    }

    setIsLocating(true);
    if (!isInitial) {
      setGeoNotice({ type: 'info', message: 'Accessing GPS device location...' });
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLocation({ lat, lng });

        try {
          const rev = await api.geo.reverse(lat, lng);
          const addr = rev.displayName || `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          setPickup({ address: addr, lat, lng });
          setGeoNotice({ type: 'success', message: `Pickup set to your current location: ${addr}` });
        } catch {
          const fallback = `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          setPickup({ address: fallback, lat, lng });
          setGeoNotice({ type: 'success', message: 'Current location coordinates detected.' });
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err.message);
        if (!isInitial) {
          setGeoNotice({
            type: 'warn',
            message: 'Location access denied or unavailable. Please search for your pickup address or tap on the map.',
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // 1. Initial Geolocation on load
  useEffect(() => {
    handleGetLocation(true);
  }, []);

  // 2. Parse query params if redirected from landing page
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pAddr = params.get('pickup');
    const dAddr = params.get('dest');
    if (pAddr) {
      api.geo.search(pAddr).then((res) => {
        if (res && res.length > 0) {
          setPickup({ address: res[0].displayName, lat: res[0].latitude, lng: res[0].longitude });
        } else {
          setPickup((prev) => ({ ...prev, address: pAddr }));
        }
      });
    }
    if (dAddr) {
      api.geo.search(dAddr).then((res) => {
        if (res && res.length > 0) {
          setDestination({ address: res[0].displayName, lat: res[0].latitude, lng: res[0].longitude });
        } else {
          setDestination((prev) => ({ ...prev, address: dAddr }));
        }
      });
    }
  }, [location.search]);

  // 3. Check if customer already has active ride on load
  useEffect(() => {
    if (user) {
      api.customer
        .getActiveRide()
        .then((ride) => {
          if (ride && ride.status !== 'CANCELLED') {
            setActiveRide(ride);
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

  // 4. Subscribe to real-time WebSocket ride updates
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

  // 5. Fetch Fare Estimates whenever coordinates or coupon change
  const fetchEstimates = async () => {
    if (!pickup.lat || !pickup.lng || !destination.lat || !destination.lng) return;
    setIsLoadingEstimate(true);
    setErrorMessage(null);
    try {
      const res = await api.rides.estimate({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: pickup.address || 'Pickup Point',
        destLat: destination.lat,
        destLng: destination.lng,
        destAddress: destination.address || 'Destination',
        couponCode: appliedCoupon || undefined,
      });
      setEstimates(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not calculate fare estimate');
      setEstimates(null);
    } finally {
      setIsLoadingEstimate(false);
    }
  };

  useEffect(() => {
    if (!activeRide && pickup.lat && destination.lat) {
      fetchEstimates();
    }
  }, [pickup.lat, pickup.lng, destination.lat, destination.lng, appliedCoupon, activeRide]);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.trim()) {
      setAppliedCoupon(couponCode.trim().toUpperCase());
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (!selectionMode) return;

    let address = `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    try {
      const rev = await api.geo.reverse(lat, lng);
      if (rev && rev.displayName) {
        address = rev.displayName;
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }

    if (selectionMode === 'pickup') {
      setPickup({ lat, lng, address });
    } else if (selectionMode === 'destination') {
      setDestination({ lat, lng, address });
    }
    setSelectionMode(null);
  };

  const handleBookRide = async () => {
    if (!user) {
      navigate('/login?redirect=/book');
      return;
    }

    if (!pickup.lat || !destination.lat) {
      setErrorMessage('Please select both pickup and destination locations.');
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
          {geoNotice && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border shadow-sm transition-all ${
                geoNotice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : geoNotice.type === 'warn'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {geoNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <Navigation className="w-4 h-4 text-brand-600 flex-shrink-0 animate-pulse" />
                )}
                <span>{geoNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setGeoNotice(null)}
                className="text-xs font-bold opacity-60 hover:opacity-100 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          <div className="bg-white rounded-3xl p-3 shadow-sm border border-slate-200">
            <MapViewer
              pickup={pickup.lat ? pickup : undefined}
              destination={destination.lat ? destination : undefined}
              captainLocation={captainLocation}
              currentLocation={currentLocation}
              routeGeometry={estimates?.routeGeometry}
              selectionMode={selectionMode}
              onMapClick={handleMapClick}
              onLocateUser={() => handleGetLocation(false)}
              isLocating={isLocating}
              className="h-[480px] lg:h-[620px] w-full rounded-2xl"
            />
          </div>

          {/* Route Summary Tag */}
          {estimates && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-200">
                  <Navigation className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900">
                    Road Route: {estimates.distanceKm} km
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Estimated travel duration ~ {estimates.durationMinutes} minutes
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Real OSRM Route
                </span>
              </div>
            </div>
          )}
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
                api.rides.getById(activeRide.id).then(setActiveRide);
              }}
            />
          ) : (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Book a Ride</h2>
                  <p className="text-xs text-slate-500">Fast, reliable city rides at transparent rates</p>
                </div>
                {isLoadingEstimate && (
                  <RefreshCw className="w-4 h-4 text-brand-600 animate-spin" />
                )}
              </div>

              {errorMessage && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Autocomplete Locations Inputs */}
              <div className="space-y-4">
                {/* Pickup Autocomplete */}
                <AddressAutocomplete
                  label="Pickup Location"
                  placeholder="Search pickup locality, landmark, or street..."
                  value={pickup.address}
                  onAddressChange={(address) => setPickup((prev) => ({ ...prev, address }))}
                  onSelectLocation={(loc) => setPickup(loc)}
                  userLat={currentLocation?.lat}
                  userLng={currentLocation?.lng}
                  markerColor="bg-emerald-500"
                  pinButton={
                    <button
                      type="button"
                      onClick={() => setSelectionMode('pickup')}
                      className="text-[11px] font-bold text-brand-700 hover:underline flex items-center gap-1"
                    >
                      <Crosshair className="w-3 h-3" /> Pin
                    </button>
                  }
                  locateButton={
                    <button
                      type="button"
                      onClick={() => handleGetLocation(false)}
                      title="Use device GPS"
                      className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> GPS
                    </button>
                  }
                />

                {/* Destination Autocomplete */}
                <AddressAutocomplete
                  label="Destination"
                  placeholder="Search destination landmark, office, or area..."
                  value={destination.address}
                  onAddressChange={(address) => setDestination((prev) => ({ ...prev, address }))}
                  onSelectLocation={(loc) => setDestination(loc)}
                  userLat={pickup.lat || currentLocation?.lat}
                  userLng={pickup.lng || currentLocation?.lng}
                  markerColor="bg-red-500"
                  pinButton={
                    <button
                      type="button"
                      onClick={() => setSelectionMode('destination')}
                      className="text-[11px] font-bold text-brand-700 hover:underline flex items-center gap-1"
                    >
                      <Crosshair className="w-3 h-3" /> Pin
                    </button>
                  }
                />
              </div>

              {/* Ride Categories list */}
              {estimates && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-500 uppercase">Available Rides</h3>
                    <span className="text-[11px] font-bold text-slate-600">
                      {estimates.distanceKm} km &bull; ~{estimates.durationMinutes} mins
                    </span>
                  </div>
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
                disabled={isBooking || !estimates || !pickup.lat || !destination.lat}
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
