import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bike,
  Shield,
  Clock,
  Zap,
  ArrowRight,
  MapPin,
  CheckCircle2,
  DollarSign,
  Smartphone,
  Users,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState('MG Road Metro Station, Bengaluru');
  const [destination, setDestination] = useState('Koramangala 5th Block, Bengaluru');

  const handleQuickBook = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/book?pickup=${encodeURIComponent(pickup)}&dest=${encodeURIComponent(destination)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-navy-900 via-navy-950 to-slate-900 text-white overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
        {/* Glow backdrop decorative circles */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Hero copy */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-bold uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 fill-brand-400" /> India's Fastest Urban Ride Network
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none text-white">
              Beat City Traffic. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-amber-200">
                Ride Faster, Pay Less.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed">
              Skip endless jams with VeloGo bike taxis, express autos, and prime cabs. Transparent pricing, verified captains, and door-to-door safety.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={() => navigate('/book')}
                className="bg-brand-500 hover:bg-brand-600 text-slate-950 font-black px-8 py-3.5 rounded-2xl shadow-glow text-base flex items-center gap-2 transition-all hover:scale-105"
              >
                Book a Ride Now <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/captain/register')}
                className="border border-slate-700 hover:border-slate-500 text-white font-bold px-6 py-3.5 rounded-2xl text-base transition-colors"
              >
                Become a Captain
              </button>
            </div>

            {/* Quick stats banner */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-800/80 max-w-md mx-auto lg:mx-0 text-left">
              <div>
                <p className="text-2xl font-black text-brand-400">&lt; 3 mins</p>
                <p className="text-xs text-slate-400">Average Pickup</p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">₹25</p>
                <p className="text-xs text-slate-400">Starting Fare</p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">100%</p>
                <p className="text-xs text-slate-400">Verified Drivers</p>
              </div>
            </div>
          </div>

          {/* Right Quick Booking Card */}
          <div className="lg:col-span-5">
            <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-extrabold text-slate-900">Where to go?</h3>
                <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
                  INSTANT ESTIMATE
                </span>
              </div>

              <form onSubmit={handleQuickBook} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Pickup Location
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      placeholder="Enter pickup point..."
                      required
                      className="w-full text-sm font-semibold pl-4 pr-10 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Destination
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Enter destination..."
                      required
                      className="w-full text-sm font-semibold pl-4 pr-10 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  </div>
                </div>

                {/* Ride category selection preview */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="p-2.5 rounded-xl border-2 border-brand-500 bg-brand-50/50 text-center cursor-pointer">
                    <Bike className="w-5 h-5 mx-auto text-brand-600" />
                    <p className="text-xs font-bold mt-1">Bike Taxi</p>
                    <p className="text-[10px] text-slate-500">From ₹25</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white text-center cursor-pointer hover:border-slate-300">
                    <span className="text-lg block">🛺</span>
                    <p className="text-xs font-bold mt-1">Auto</p>
                    <p className="text-[10px] text-slate-500">From ₹35</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white text-center cursor-pointer hover:border-slate-300">
                    <span className="text-lg block">🚗</span>
                    <p className="text-xs font-bold mt-1">Cab</p>
                    <p className="text-[10px] text-slate-500">From ₹70</p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-500 hover:bg-brand-600 text-slate-950 font-black py-3.5 rounded-xl shadow-glow text-base flex items-center justify-center gap-2 transition-all mt-4"
                >
                  See Fares & Book <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Showcase */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Tailored For Every Journey
          </h2>
          <p className="text-3xl font-black text-slate-900 mt-2">
            Choose how you travel across the city
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Bike */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 hover:shadow-xl transition-all relative overflow-hidden group">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Bike className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">VeloGo Bike Taxi</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Fastest way through peak-hour city traffic. Ideal for solo travelers and quick daily office commutes.
            </p>
            <ul className="mt-6 space-y-2.5 text-xs text-slate-700 font-semibold">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Sanitized helmet provided
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Up to 50% cheaper than cabs
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Zero waiting at traffic bottlenecks
              </li>
            </ul>
          </div>

          {/* Auto */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 hover:shadow-xl transition-all relative overflow-hidden group">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
              🛺
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">VeloGo Auto Express</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              No bargaining, no meters refused. Doorstep auto rickshaws with upfront fixed pricing.
            </p>
            <ul className="mt-6 space-y-2.5 text-xs text-slate-700 font-semibold">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Up to 3 passengers
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Pocket-friendly local rides
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Transparent digital receipts
              </li>
            </ul>
          </div>

          {/* Cab */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 hover:shadow-xl transition-all relative overflow-hidden group">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
              🚗
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">VeloGo Prime Cab</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Air-conditioned sedans and hatchbacks for airport transfers, family outings, and relaxed travels.
            </p>
            <ul className="mt-6 space-y-2.5 text-xs text-slate-700 font-semibold">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Spacious trunk & AC comfort
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> High-rated experienced drivers
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Real-time route tracking
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Safety & Trust Feature Grid */}
      <section className="bg-slate-900 text-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-400">
              Safety First, Always
            </h2>
            <p className="text-3xl font-black text-white mt-2">
              Every ride engineered with 360° protection
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3">
              <Shield className="w-8 h-8 text-brand-400" />
              <h4 className="font-extrabold text-lg">Verified Captains</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Background checks, valid driving licenses, and vehicle inspection before anyone takes a ride.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3">
              <Zap className="w-8 h-8 text-brand-400" />
              <h4 className="font-extrabold text-lg">Secure Start OTP</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Trips only begin when you share your secret 4-digit OTP with your assigned captain.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3">
              <Smartphone className="w-8 h-8 text-brand-400" />
              <h4 className="font-extrabold text-lg">Live Trip Sharing</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Share your live GPS ride tracking link with friends and family with a single tap.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3">
              <Clock className="w-8 h-8 text-brand-400" />
              <h4 className="font-extrabold text-lg">24x7 Safety Support</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dedicated rapid-response team and emergency contacts integration in every dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Driver Onboarding Call to Action */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-gradient-to-r from-brand-500 to-amber-500 rounded-3xl p-8 sm:p-12 text-slate-950 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
          <div className="space-y-3 max-w-xl">
            <h3 className="text-3xl font-black tracking-tight leading-tight">
              Earn up to ₹35,000/month driving with VeloGo
            </h3>
            <p className="text-sm font-semibold text-slate-900 leading-relaxed">
              Flexible hours, instant daily payouts, zero platform commission on initial rides, and comprehensive rider insurance.
            </p>
          </div>
          <button
            onClick={() => navigate('/captain/register')}
            className="bg-navy-950 hover:bg-slate-900 text-white font-black px-8 py-4 rounded-2xl text-base shadow-2xl flex-shrink-0 transition-transform hover:scale-105"
          >
            Register as Captain Today
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bike className="w-5 h-5 text-brand-500" />
            <span className="font-extrabold text-slate-900 text-sm">VeloGo Technologies</span>
          </div>
          <p>&copy; {new Date().getFullYear()} VeloGo Inc. All rights reserved. Built for lightning-fast city travel.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-800 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-800 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-800 cursor-pointer">Pricing Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
