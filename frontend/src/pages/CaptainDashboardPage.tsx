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
  ShieldCheck,
  Star,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { MapViewer } from '../components/MapViewer';

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

  // Women-Only application modal
  const [showWomenOnlyModal, setShowWomenOnlyModal] = useState(false);
  const [womenOnlyAcknowledged, setWomenOnlyAcknowledged] = useState(false);
  const [isApplyingWomenOnly, setIsApplyingWomenOnly] = useState(false);
  const [womenOnlyFeedback, setWomenOnlyFeedback] = useState<string | null>(null);

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSimulatingLoc, setIsSimulatingLoc] = useState(false);

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

  // Toggle online / offline status
  const handleToggleOnline = async () => {
    if (!profile) return;
    setIsUpdatingStatus(true);
    try {
      const nextOnline = !profile.online;
      const updated = await api.captain.toggleAvailability(nextOnline);
      setProfile(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to update online status');
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
      alert(err.message || 'Ride was taken or expired');
      setIncomingDispatch(null);
    }
  };

  // Reject incoming dispatch
  const handleRejectDispatch = () => {
    setIncomingDispatch(null);
  };

  // Captain marks arrival at pickup
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

  // Handle Women-Only program application
  const handleApplyWomenOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!womenOnlyAcknowledged) {
      alert('Please confirm the demo self-declaration checkbox.');
      return;
    }

    setIsApplyingWomenOnly(true);
    setWomenOnlyFeedback(null);
    try {
      const updated = await api.captain.applyWomenOnly(true);
      setProfile(updated);
      setShowWomenOnlyModal(false);
      setWomenOnlyFeedback('Application submitted successfully! Your application is pending admin approval.');
    } catch (err: any) {
      alert(err.message || 'Application failed');
    } finally {
      setIsApplyingWomenOnly(false);
    }
  };

  const isBikeCaptain = profile?.vehicle?.category === 'BIKE' || profile?.vehicle?.category === 'WOMEN_BIKE';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header bar */}
      <div className="bg-navy-900 text-white rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-slate-950 flex items-center justify-center font-black shadow-glow">
            {profile?.vehicle?.category === 'BIKE' || profile?.vehicle?.category === 'WOMEN_BIKE' ? (
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
              {profile?.womenOnlyEligible && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Women-Only Approved
                </span>
              )}
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

      {womenOnlyFeedback && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center gap-3 text-purple-900 text-xs font-semibold">
          <ShieldCheck className="w-5 h-5 text-purple-600 flex-shrink-0" />
          <span>{womenOnlyFeedback}</span>
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

      {/* Women-Only Bike Program Enrollment Card (for Bike Captains) */}
      {isBikeCaptain && (
        <div className="bg-purple-50/60 rounded-3xl p-6 border border-purple-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-purple-950">Women-Only Bike Service Program</h3>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    profile?.womenOnlyStatus === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : profile?.womenOnlyStatus === 'APPLIED'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : profile?.womenOnlyStatus === 'REJECTED'
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {profile?.womenOnlyStatus === 'APPROVED'
                      ? 'Approved & Eligible'
                      : profile?.womenOnlyStatus === 'APPLIED'
                      ? 'Application Under Review'
                      : profile?.womenOnlyStatus === 'REJECTED'
                      ? 'Application Rejected'
                      : 'Not Applied'}
                  </span>
                </div>
                <p className="text-xs text-purple-800/80 mt-0.5">
                  Exclusive trips reserved for women passengers with verified female captains.
                </p>
              </div>
            </div>

            {/* Application action button */}
            {(!profile?.womenOnlyStatus || profile?.womenOnlyStatus === 'NOT_APPLIED' || profile?.womenOnlyStatus === 'REJECTED') && (
              <button
                type="button"
                onClick={() => setShowWomenOnlyModal(true)}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-sm whitespace-nowrap"
              >
                Apply for Women-Only Program
              </button>
            )}

            {profile?.womenOnlyStatus === 'APPLIED' && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                ⏳ Pending Admin Review
              </span>
            )}

            {profile?.womenOnlyStatus === 'APPROVED' && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Dispatches Enabled
              </span>
            )}
          </div>

          <div className="p-3 bg-white/70 rounded-xl border border-purple-100 text-[11px] text-purple-900 space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
              <span><strong>Demo Verification Notice:</strong> Program eligibility is granted exclusively via administrator review of demo self-declarations. Submission does not auto-grant eligibility.</span>
            </p>
            {profile?.womenOnlyRejectionReason && (
              <p className="text-red-700 font-semibold pt-1">
                Rejection Note: {profile.womenOnlyRejectionReason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Active Trip Execution Console */}
      {activeRide ? (
        <div className={`bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 space-y-6 ${
          activeRide.vehicleCategory === 'WOMEN_BIKE' ? 'border-purple-500' : 'border-brand-500'
        }`}>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  activeRide.vehicleCategory === 'WOMEN_BIKE'
                    ? 'bg-purple-600 text-white'
                    : 'bg-brand-500 text-slate-950'
                }`}>
                  {activeRide.vehicleCategory === 'WOMEN_BIKE' ? 'WOMEN-ONLY BIKE TRIP' : 'ACTIVE TRIP IN PROGRESS'}
                </span>
                {activeRide.isForSomeoneElse && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Booked for Relative / Friend
                  </span>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                {activeRide.isForSomeoneElse
                  ? `Traveler: ${activeRide.travelerName || 'Passenger'} (${activeRide.travelerRelationship || 'Traveler'})`
                  : `Passenger: ${activeRide.customerName}`}
              </h3>
              <p className="text-xs text-slate-500">
                Contact: {activeRide.isForSomeoneElse && activeRide.travelerPhone ? activeRide.travelerPhone : activeRide.customerPhone}
                {activeRide.isForSomeoneElse && ` (Booked by ${activeRide.customerName})`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 uppercase">Fare Amount</span>
              <p className="text-2xl font-black text-slate-900">
                ₹{(activeRide.finalFare || activeRide.estimatedFare).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Active Trip Route Map */}
          <div className="rounded-2xl overflow-hidden border border-slate-200 h-[280px] sm:h-[340px] shadow-inner relative">
            <MapViewer
              pickup={{
                lat: activeRide.pickupLat,
                lng: activeRide.pickupLng,
                address: activeRide.pickupAddress,
              }}
              destination={{
                lat: activeRide.destLat,
                lng: activeRide.destLng,
                address: activeRide.destAddress,
              }}
              captainLocation={
                activeRide.captainCurrentLat && activeRide.captainCurrentLng
                  ? { lat: activeRide.captainCurrentLat, lng: activeRide.captainCurrentLng }
                  : profile?.currentLatitude && profile?.currentLongitude
                  ? { lat: profile.currentLatitude, lng: profile.currentLongitude }
                  : undefined
              }
              routeDistanceKm={activeRide.distanceKm}
              routeDurationMins={activeRide.durationMinutes}
              interactiveSelectionPopup={false}
              showPinControls={false}
              className="h-full w-full"
            />
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
                <Key className="w-5 h-5 stroke-[2.5]" />
                Verify Customer OTP & Start Trip
              </button>
            )}

            {activeRide.status === 'IN_PROGRESS' && (
              <div className="space-y-3">
                <button
                  onClick={handleSimulateGPS}
                  disabled={isSimulatingLoc}
                  className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Navigation className="w-4 h-4 animate-spin" />
                  {isSimulatingLoc ? 'Broadcasting simulated GPS navigation...' : 'Simulate GPS Navigation Movement'}
                </button>
                <button
                  onClick={handleComplete}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl text-base shadow-lg transition-all"
                >
                  Complete Trip at Destination
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Standby state */
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Navigation className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {profile?.online ? 'Waiting for Nearby Dispatch Offers' : 'You are currently Offline'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {profile?.online
                ? 'Keep this window open. When a customer nearby requests a ride matching your vehicle, you will see a live 45-second offer countdown.'
                : 'Tap "Go Online" above to start receiving ride dispatches in your area.'}
            </p>
          </div>
        </div>
      )}

      {/* Incoming Dispatch Modal (45s live countdown) */}
      {incomingDispatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-4 border-brand-500 animate-fadeIn relative">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                incomingDispatch.category === 'WOMEN_BIKE'
                  ? 'bg-purple-600 text-white'
                  : 'bg-brand-500 text-slate-950'
              }`}>
                {incomingDispatch.category === 'WOMEN_BIKE' ? '🛡️ WOMEN-ONLY RIDE' : 'NEW RIDE DISPATCH'}
              </span>
              <div className="flex items-center gap-1.5 font-mono text-sm font-extrabold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                <Clock className="w-4 h-4 animate-spin" />
                <span>{countdown}s left</span>
              </div>
            </div>

            {/* Fare & Passenger */}
            <div className="text-center my-4">
              <p className="text-3xl font-black text-slate-900">
                ₹{Number(incomingDispatch.estimatedFare).toFixed(2)}
              </p>
              <p className="text-xs font-bold text-slate-600 mt-1">
                {incomingDispatch.customerName}
              </p>
              <p className="text-[11px] text-slate-400">
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

      {/* Women-Only Program Application Modal */}
      {showWomenOnlyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-fadeIn space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Women-Only Bike Service Application</h3>
              <p className="text-xs text-slate-500">
                Join our certified women captain fleet to serve dedicated women commuters.
              </p>
            </div>

            <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 space-y-2">
              <p className="font-bold">Demo Verification & Self-Declaration Terms:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-purple-800">
                <li>This application initiates an administrator review.</li>
                <li>Application submission does not automatically grant eligibility.</li>
                <li>This is a prototype demo self-declaration workflow and does not claim to represent government ID or biological proof.</li>
              </ul>
            </div>

            <form onSubmit={handleApplyWomenOnly} className="space-y-4">
              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={womenOnlyAcknowledged}
                  onChange={(e) => setWomenOnlyAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <span>
                  I self-declare my eligibility as a female captain with a verified two-wheeler and request administrator approval for the Women-Only Bike program.
                </span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isApplyingWomenOnly || !womenOnlyAcknowledged}
                  className="flex-1 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-black py-3 rounded-xl shadow-md text-sm transition-all"
                >
                  {isApplyingWomenOnly ? 'Submitting...' : 'Submit Application'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowWomenOnlyModal(false)}
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
