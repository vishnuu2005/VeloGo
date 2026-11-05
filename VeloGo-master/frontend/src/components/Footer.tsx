import React from 'react';
import { Bike, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-white font-bold">
          <Bike className="w-5 h-5 text-brand-500" />
          <span>VeloGo Mobility</span>
        </div>
        <p className="text-slate-500">
          © {new Date().getFullYear()} VeloGo. All rights reserved. Built with pride for urban commuters.
        </p>
        <div className="flex items-center gap-4 text-slate-400">
          <a href="/safety" className="hover:text-white transition-colors">Safety</a>
          <a href="/plans" className="hover:text-white transition-colors">Passes</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms</a>
        </div>
      </div>
    </footer>
  );
};
