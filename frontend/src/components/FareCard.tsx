import React, { useState } from 'react';
import { CategoryEstimate, VehicleCategory } from '../types';
import { Bike, Car, ChevronDown, ChevronUp, Clock, Info, ShieldCheck } from 'lucide-react';

interface FareCardProps {
  estimate: CategoryEstimate;
  isSelected: boolean;
  onSelect: () => void;
}

export const FareCard: React.FC<FareCardProps> = ({ estimate, isSelected, onSelect }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getCategoryIcon = (cat: VehicleCategory) => {
    switch (cat) {
      case 'BIKE':
        return <Bike className="w-6 h-6 text-brand-600" />;
      case 'AUTO':
        return (
          <div className="w-6 h-6 flex items-center justify-center font-black text-amber-700 bg-amber-100 rounded">
            🛺
          </div>
        );
      case 'CAB':
        return <Car className="w-6 h-6 text-emerald-600" />;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`relative cursor-pointer transition-all duration-200 rounded-2xl border-2 p-4 ${
        isSelected
          ? 'border-brand-500 bg-brand-50/40 shadow-glow'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between">
        {/* Left: Icon & Category name */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
            {getCategoryIcon(estimate.category)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 text-base">{estimate.categoryName}</h4>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <Clock className="w-3 h-3" /> {estimate.etaText}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {estimate.distanceKm} km &bull; ~{estimate.durationMinutes} mins travel time
            </p>
          </div>
        </div>

        {/* Right: Price & select indicator */}
        <div className="text-right">
          {estimate.discountAmount > 0 && (
            <p className="text-xs text-slate-400 line-through font-medium">
              ₹{(estimate.totalFare + estimate.discountAmount).toFixed(2)}
            </p>
          )}
          <p className="text-xl font-extrabold text-slate-900">
            ₹{estimate.totalFare.toFixed(2)}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            className="text-[11px] font-medium text-brand-700 hover:underline inline-flex items-center gap-0.5 mt-0.5"
          >
            Breakdown {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Breakdown Details Collapsible */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-200/80 text-xs text-slate-600 space-y-1.5 animate-fadeIn">
          <div className="flex justify-between">
            <span>Base Fare</span>
            <span>₹{estimate.baseFare.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Distance Charge ({estimate.distanceKm} km)</span>
            <span>₹{estimate.distanceCharge.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Time Charge ({estimate.durationMinutes} mins)</span>
            <span>₹{estimate.timeCharge.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform & Safety Fee</span>
            <span>₹{estimate.bookingFee.toFixed(2)}</span>
          </div>
          {estimate.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>Promotional Discount</span>
              <span>-₹{estimate.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-400">
            <span>Applicable Taxes</span>
            <span>₹{estimate.taxAmount.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
