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

const PRESET_LOCATIONS = [
  { name: 'MG Road Metro Station', lat: 12.9756, lng: 77.6066 },
  { name: 'Koramangala 5th Block', lat: 12.9352, lng: 77.6245 },
  { name: 'Indiranagar 100ft Road', lat: 12.9785, lng: 77.6408 },
  { name: 'Majestic Bus Terminal', lat: 12.9784, lng: 77.5726 },
  { name: 'Electronic City Phase 1', lat: 12.8452, lng: 77.6602 },
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

  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse query params if redirected from landing page
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pAddr = params.get('pickup');
    const dAddr = params.get('dest');
    if (pAddr) setPickup((prev) => ({ ...prev, address: pAddr }));
    if (dAddr) setDestination((prev) => ({ ...prev, address: dAddr }));
  }, [location.search]);

  // Check if customer already has active ride on load
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
    if (!activeRide) {
      fetchEstimates();
    }
  }, [pickup.lat, pickup.lng, destination.lat, destination.lng, appliedCoupon, activeRide]);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.trim()) {
      setAppliedCoupon(couponCode.trim().toUpperCase());
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (selectionMode === 'pickup') {
      setPickup({
        lat,
        lng,
        address: `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      });
      setSelectionMode(null);
    } else if (selectionMode === 'destination') {
      setDestination({
        lat,
        lng,
        address: `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      });
      setSelectionMode(null);
    }
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
          <div className="bg-white rounded-3xl p-3 shadow-sm border border-slate-200">
            <MapViewer
              pickup={pickup}
              destination={destination}
              captainLocation={captainLocation}
              selectionMode={selectionMode}
              onMapClick={handleMapClick}
              className="h-[480px] lg:h-[620px] w-full rounded-2xl"
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
                    name: spot.name,
                    lat: spot.lat,
                    lng: spot.lng,
                    address: spot.name + ', Bengaluru',
                  } as any)
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

              {/* Locations Input */}
              <div className="space-y-4">
                {/* Pickup */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Pickup Location
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectionMode('pickup')}
                      className="text-[11px] font-bold text-brand-700 hover:underline flex items-center gap-1"
                    >
                      <Crosshair className="w-3 h-3" /> Pin on map
                    </button>
                  </div>
                  <input
                    type="text"
                    value={pickup.address}
                    onChange={(e) => setPickup((prev) => ({ ...prev, address: e.target.value }))}
                    className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Destination */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Destination
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectionMode('destination')}
                      className="text-[11px] font-bold text-brand-700 hover:underline flex items-center gap-1"
                    >
                      <Crosshair className="w-3 h-3" /> Pin on map
                    </button>
                  </div>
                  <input
                    type="text"
                    value={destination.address}
                    onChange={(e) =>
                      setDestination((prev) => ({ ...prev, address: e.target.value }))
                    }
                    className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

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
