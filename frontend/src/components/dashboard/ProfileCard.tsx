import React from 'react';

interface ProfileCardProps {
  name?: string;
  email?: string;
  role: 'admin' | 'staff';
  isApproved?: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ name, email, role, isApproved }) => {
  return (
    <section className="relative rounded-2xl border border-slate-500/30 bg-transparent p-5 shadow-xl shadow-slate-950/10">
      {/* Content Layer */}
      <div className="relative z-10">
        <h2 className="text-2xl font-semibold tracking-[0.05em] text-white">Profile</h2>
        <div className="mt-4 space-y-3 text-lg">
          <div>
            <p className="text-base tracking-[0.045em] text-slate-400">Name</p>
            <p className="font-medium tracking-[0.04em] text-slate-100">{name || 'Not available'}</p>
          </div>
          <div>
            <p className="text-base tracking-[0.045em] text-slate-400">Email</p>
            <p className="break-all font-medium tracking-[0.04em] text-slate-100">{email || 'Not available'}</p>
          </div>
          <div>
            <p className="text-base tracking-[0.045em] text-slate-400">Role</p>
            <p className="font-medium capitalize tracking-[0.04em] text-slate-100">{role}</p>
          </div>
          <div>
            <p className="text-base tracking-[0.045em] text-slate-400">Approval</p>
            <p className={`font-medium tracking-[0.04em] ${isApproved ? 'text-emerald-300' : 'text-amber-300'}`}>
              {isApproved ? 'Approved' : 'Pending Approval'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
