import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import { CaptainSummary, Ride } from '../types';
import {
  Bike,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  Key,
  MapPin,
  Navigation,
  Power,
  Shield,
  Star,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export const CaptainDashboardPage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { subscribeToCaptainDispatch, subscribeToRide } = useSocket();

  const [profile, setProfile] = useState<CaptainSummary | null>(user?.captainProfile || null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [history, setHistory] = useState<Ride[]>([]);

  // Incoming dispatch card with countdown
  const [incomingDispatch, setIncomingDispatch] = useState<any | null>(null);
  const [countdown, setCountdown] = useState(45);

  // OTP dialog
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Load initial data
  const loadData = async () => {
    try {
      const p = await api.captain.getProfile();
      setProfile(p);
      const active = await api.captain.getActiveRide();
      setActiveRide(active);
      const h = await api.captain.getHistory();
      setHistory(h);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Listen for incoming dispatches via WebSocket
  useEffect(() => {
    if (!profile?.captainId) return;

    const unsub = subscribeToCaptainDispatch(profile.captainId, (dispatch) => {
      setIncomingDispatch(dispatch);
      setCountdown(dispatch.countdownSeconds || 45);
    });

    return () => unsub();
  }, [profile?.captainId]);

  // Countdown timer for incoming dispatch
  useEffect(() => {
    if (!incomingDispatch) return;

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setIncomingDispatch(null);
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingDispatch]);

  // Listen to active ride updates
  useEffect(() => {
    if (!activeRide) return;

    const unsub = subscribeToRide(activeRide.id, (updated) => {
      setActiveRide(updated);
      if (updated.status === 'COMPLETED' || updated.status === 'CANCELLED') {
        loadData();
      }
    });

    return () => unsub();
  }, [activeRide?.id]);

  // Toggle online / offline
  const handleToggleOnline = async () => {
    if (!profile) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await api.captain.toggleAvailability(!profile.online);
      setProfile(updated);
      await refreshProfile();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle availability');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Accept incoming dispatch
  const handleAcceptDispatch = async () => {
    if (!incomingDispatch) return;
    try {
      const ride = await api.captain.acceptRide(incomingDispatch.rideId);
      setActiveRide(ride);
      setIncomingDispatch(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to accept ride');
      setIncomingDispatch(null);
    }
  };

  // Reject dispatch
  const handleRejectDispatch = () => {
    setIncomingDispatch(null);
  };

  // Arrive at pickup
  const handleArrive = async () => {
    if (!activeRide) return;
    try {
      const updated = await api.captain.arriveAtPickup(activeRide.id);
      setActiveRide(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to update arrival');
    }
  };

  // Start trip with OTP
  const handleStartTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRide) return;
    setOtpError(null);
    try {
      const updated = await api.captain.startTrip(activeRide.id, otpInput.trim());
      setActiveRide(updated);
      setShowOtpDialog(false);
      setOtpInput('');
    } catch (err: any) {
      setOtpError(err.message || 'Invalid OTP code');
    }
  };

  // Complete trip
  const handleComplete = async () => {
    if (!activeRide) return;
    try {
      const updated = await api.captain.completeTrip(activeRide.id);
      setActiveRide(updated);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to complete trip');
    }
  };

  // GPS Simulation: Moves captain smoothly towards destination
  const handleSimulateGPS = async () => {
    if (!activeRide || isSimulatingLoc) return;
    setIsSimulatingLoc(true);

    const startLat = activeRide.pickupLat;
    const startLng = activeRide.pickupLng;
    const endLat = activeRide.destLat;
    const endLng = activeRide.destLng;

    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const curLat = startLat + ((endLat - startLat) * i) / steps;
      const curLng = startLng + ((endLng - startLng) * i) / steps;

      await api.captain.updateLocation(curLat, curLng, 45);
      await new Promise((r) => setTimeout(r, 1200));
    }

    setIsSimulatingLoc(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header bar */}
      <div className="bg-navy-900 text-white rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-slate-950 flex items-center justify-center font-black shadow-glow">
            {profile?.vehicle?.category === 'BIKE' ? (
              <Bike className="w-8 h-8" />
            ) : (
              <Car className="w-8 h-8" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">{user?.fullName}</h2>
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  profile?.verificationStatus === 'APPROVED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}
              >
                {profile?.verificationStatus}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {profile?.vehicle?.model} &bull; {profile?.vehicle?.registrationNumber} ({profile?.vehicle?.category})
            </p>
          </div>
        </div>

        {/* Online / Offline switch */}
        <button
          disabled={isUpdatingStatus || profile?.verificationStatus !== 'APPROVED'}
          onClick={handleToggleOnline}
          className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg ${
            profile?.online
              ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <Power className="w-5 h-5 stroke-[3]" />
          <span>{profile?.online ? 'YOU ARE ONLINE' : 'GO ONLINE'}</span>
        </button>
      </div>

      {profile?.verificationStatus === 'PENDING' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 text-xs font-semibold">
          <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>
            Your driving license and vehicle registration are currently undergoing admin verification. You will be able to go online once approved.
          </span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Total Earnings</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            ₹{profile?.totalEarnings ? Number(profile.totalEarnings).toFixed(2) : '0.00'}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Completed Rides</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {profile?.totalRides || 0}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Captain Rating</p>
          <p className="text-2xl font-black text-amber-600 mt-1 flex items-center justify-center gap-1">
            <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
            {profile?.ratingAvg ? Number(profile.ratingAvg).toFixed(1) : '5.0'}
          </p>
        </div>
      </div>

      {/* Active Trip Execution Console */}
      {activeRide ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-brand-500 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-brand-500 text-slate-950 px-2.5 py-1 rounded-full">
                ACTIVE TRIP IN PROGRESS
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                Passenger: {activeRide.customerName}
              </h3>
              <p className="text-xs text-slate-500">{activeRide.customerPhone}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 uppercase">Fare Amount</span>
              <p className="text-2xl font-black text-slate-900">
                ₹{(activeRide.finalFare || activeRide.estimatedFare).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Route Info */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="font-bold text-slate-400 uppercase text-[9px] block">Pickup</span>
              <span className="font-semibold text-slate-800">{activeRide.pickupAddress}</span>
            </div>
            <div>
              <span className="font-bold text-slate-400 uppercase text-[9px] block">Drop Location</span>
              <span className="font-semibold text-slate-800">{activeRide.destAddress}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 text-slate-500 text-[11px]">
              <span>Distance: {activeRide.distanceKm} km</span>
              <span>Estimated: ~{activeRide.durationMinutes} mins</span>
            </div>
          </div>

          {/* Action buttons matching lifecycle */}
          <div className="space-y-3">
            {activeRide.status === 'ACCEPTED' && (
              <button
                onClick={handleArrive}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-4 rounded-2xl text-base shadow-lg transition-all"
              >
                I Have Arrived at Pickup Location
              </button>
            )}

            {activeRide.status === 'ARRIVED' && (
              <button
                onClick={() => setShowOtpDialog(true)}
                className="w-full bg-brand-500 hover:bg-brand-600 text-slate-950 font-black py-4 rounded-2xl text-base shadow-glow flex items-center justify-center gap-2 transition-all"
              >
                <Key className="w-5 h-5" /> Enter Customer OTP to Start Trip
              </button>
            )}

            {activeRide.status === 'IN_PROGRESS' && (
              <div className="space-y-3">
                <button
                  onClick={handleComplete}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl text-base shadow-lg transition-all"
                >
                  Complete Trip & Collect Fare
                </button>
                <button
                  disabled={isSimulatingLoc}
                  onClick={handleSimulateGPS}
                  className="w-full border-2 border-brand-500 text-brand-800 font-bold py-2.5 rounded-xl text-xs hover:bg-brand-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4 text-brand-600" />
                  {isSimulatingLoc ? 'Simulating GPS Driving...' : 'Simulate GPS Movement on Customer Map'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Compass className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-lg text-slate-900">
            {profile?.online ? 'Looking for trip requests...' : 'You are currently Offline'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {profile?.online
              ? 'Stay on this screen. When a passenger books a ride in your area, an incoming dispatch alert with 45s timer will appear here.'
              : 'Turn on your availability above to start receiving ride requests.'}
          </p>
        </div>
      )}

      {/* Ride History */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
        <h3 className="font-extrabold text-base text-slate-900">Recent Completed Trips</h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No completed trips yet.</p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{r.customerName}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5 truncate max-w-xs">
                    {r.pickupAddress} &rarr; {r.destAddress}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">₹{(r.finalFare || r.estimatedFare).toFixed(2)}</p>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incoming Ride Dispatch Modal */}
      {incomingDispatch && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border-4 border-brand-500 animate-fadeIn">
            {/* Countdown Badge */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-wider bg-brand-500 text-slate-950 px-3 py-1 rounded-full">
                NEW RIDE OFFER
              </span>
              <div className="flex items-center gap-1 font-mono text-sm font-black text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-200">
                <Clock className="w-4 h-4" /> {countdown}s
              </div>
            </div>

            <div className="text-center py-2">
              <p className="text-xs font-bold text-slate-400 uppercase">Estimated Trip Fare</p>
              <p className="text-4xl font-black text-slate-950 my-1">
                ₹{Number(incomingDispatch.estimatedFare).toFixed(2)}
              </p>
              <p className="text-xs text-slate-500 font-semibold">
                {incomingDispatch.distanceKm} km &bull; ~{incomingDispatch.durationMinutes} mins
              </p>
            </div>

            {/* Route */}
            <div className="bg-slate-50 rounded-2xl p-4 my-4 space-y-2.5 text-xs border border-slate-200">
              <div>
                <span className="font-bold text-slate-400 uppercase text-[9px] block">Pickup</span>
                <span className="font-semibold text-slate-800">{incomingDispatch.pickupAddress}</span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase text-[9px] block">Destination</span>
                <span className="font-semibold text-slate-800">{incomingDispatch.destAddress}</span>
              </div>
            </div>

            {/* Accept / Reject Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={handleRejectDispatch}
                className="border-2 border-slate-300 hover:bg-slate-100 text-slate-700 font-extrabold py-3.5 rounded-xl text-sm transition-colors"
              >
                Pass / Reject
              </button>
              <button
                onClick={handleAcceptDispatch}
                className="bg-brand-500 hover:bg-brand-600 text-slate-950 font-black py-3.5 rounded-xl shadow-glow text-sm transition-all"
              >
                Accept Ride
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP verification Dialog */}
      {showOtpDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative animate-fadeIn">
            <h3 className="font-black text-xl text-slate-900 text-center">Verify Customer OTP</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Ask customer for their 4-digit ride OTP
            </p>

            {otpError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 text-center">
                {otpError}
              </div>
            )}

            <form onSubmit={handleStartTrip} className="mt-4 space-y-4">
              <input
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="4-digit OTP"
                autoFocus
                required
                className="w-full text-center tracking-widest font-mono text-2xl font-black p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-brand-500 hover:bg-brand-600 text-slate-950 font-black py-3 rounded-xl shadow-glow text-sm"
                >
                  Verify & Start Trip
                </button>
                <button
                  type="button"
                  onClick={() => setShowOtpDialog(false)}
                  className="px-4 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
