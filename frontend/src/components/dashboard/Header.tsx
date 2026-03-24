import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan } from 'lucide-react';
import coffeeShopVideo from '../../Ass/coffee-shop.3840x2160.mp4';

interface HeaderProps {
  username?: string;
  role: 'admin' | 'staff';
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ username, role, onLogout }) => {
  const navigate = useNavigate();
  const isAdmin = role === 'admin';

  const roleStyles =
    role === 'admin'
      ? 'bg-purple-500/20 text-purple-200 border-purple-400/30'
      : 'bg-sky-500/20 text-sky-200 border-sky-400/30';

  return (
    <header className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/40 backdrop-blur-sm sm:p-6">
      {isAdmin && (
        <>
          <video
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          >
            <source src={coffeeShopVideo} type="video/mp4" />
          </video>
          <div className="pointer-events-none absolute inset-0 bg-slate-950/60" />
        </>
      )}

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-200/80">VisionBite</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            Welcome back, <span className="font-semibold text-slate-100">{username || 'User'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/visionbite')}
            className="flex items-center gap-2 rounded-xl border border-blue-400/35 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/25 hover:scale-[1.02]"
          >
            <Scan size={16} />
            VisionBite AI
          </button>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${roleStyles}`}>
            {role}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-rose-400/35 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25 hover:scale-[1.02]"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};
