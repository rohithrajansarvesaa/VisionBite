import React from 'react';
import { motion } from 'framer-motion';

export interface KPIItem {
  id: string;
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}

interface KPICardsProps {
  items: KPIItem[];
}

export const KPICards: React.FC<KPICardsProps> = ({ items }) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {items.map((item, index) => (
        <motion.article
          key={item.id}
          className="group relative overflow-hidden rounded-lg border border-slate-600/40 bg-gradient-to-br from-slate-700/50 via-slate-800/50 to-slate-900/60 p-4 backdrop-blur-md shadow-xl shadow-slate-950/40 transition-all hover:border-slate-500/60 hover:shadow-lg hover:shadow-blue-500/5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 + index * 0.05 }}
          whileHover={{ scale: 1.02, y: -2 }}
        >
          {/* Metallic highlight overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 flex flex-col gap-2">
            {/* Label */}
            <p className="text-sm font-bold uppercase text-slate-300 transition-colors group-hover:text-slate-200" style={{ fontFamily: 'BebasNeue', letterSpacing: '0.12em' }}>
              {item.label}
            </p>

            {/* Value */}
            <p className="text-3xl font-black text-white" style={{ fontFamily: 'BebasNeue', letterSpacing: '0.05em' }}>
              {item.value}
            </p>

            {/* Subtitle */}
            {item.subtitle && (
              <p className="text-sm leading-tight tracking-[0.045em] text-slate-400 transition-colors group-hover:text-slate-300">{item.subtitle}</p>
            )}
          </div>

          {/* Bottom metallic accent edge */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-400/30 to-transparent group-hover:via-slate-300/40 transition-all" />
        </motion.article>
      ))}
    </div>
  );
};
