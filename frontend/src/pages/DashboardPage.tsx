import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { adminService } from '@/services/api';
import { PendingUser } from '@/types';
import { Header } from '@/components/dashboard/Header';
import { KPICards, KPIItem } from '@/components/dashboard/KPICards';
import { ProfileCard } from '@/components/dashboard/ProfileCard';
import { ApprovalSection } from '@/components/dashboard/ApprovalSection';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const iconClassName = 'h-5 w-5';

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 2.5 2.5L16 9" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 7v6c0 5 3.5 7.8 8 9 4.5-1.2 8-4 8-9V7l-8-4z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
  </svg>
);

const PulseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h4l2-5 4 10 2-5h8" />
  </svg>
);

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [approvedStaffCount, setApprovedStaffCount] = useState<number>(0);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (type: ToastMessage['type'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [isAdmin]);

  const fetchDashboardData = async () => {
    if (!isAdmin) {
      return;
    }

    await Promise.all([fetchPendingUsers(), fetchApprovedStaffCount()]);
  };

  const fetchPendingUsers = async () => {
    try {
      setLoadingPending(true);
      const response = await adminService.getPendingUsers();
      setPendingUsers(response.data.users);
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to fetch pending users');
    } finally {
      setLoadingPending(false);
    }
  };

  const fetchApprovedStaffCount = async () => {
    try {
      setLoadingApproved(true);
      const response = await adminService.getApprovedStaff();
      setApprovedStaffCount(response.data?.count ?? 0);
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to fetch approved staff');
    } finally {
      setLoadingApproved(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setProcessingId(id);
      const response = await adminService.approveUser(id);
      showToast('success', response.data?.message || 'Staff member approved');
      await fetchDashboardData();
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to approve user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setProcessingId(id);
      const response = await adminService.rejectUser(id);
      showToast('success', response.data?.message || 'Staff member rejected');
      await fetchDashboardData();
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to reject user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const totalStaff = isAdmin ? pendingUsers.length + approvedStaffCount : 'Restricted';
  const approvedStaff = isAdmin ? approvedStaffCount : user?.isApproved ? 1 : 0;
  const activeUsers = isAdmin ? approvedStaffCount + 1 : user?.isApproved ? 1 : 0;
  const isLoadingStats = loadingPending || loadingApproved;

  const kpis: KPIItem[] = [
    {
      id: 'total-staff',
      label: 'Total Staff',
      value: isLoadingStats && isAdmin ? '...' : totalStaff,
      subtitle: isAdmin ? 'Approved + pending' : 'Admin visibility only',
      icon: <UsersIcon />,
    },
    ...(isAdmin
      ? [
          {
            id: 'pending-approvals',
            label: 'Pending Approvals',
            value: loadingPending ? '...' : pendingUsers.length,
            subtitle: 'Requires action',
            icon: <ClockIcon />,
          } as KPIItem,
        ]
      : []),
    {
      id: 'approved-staff',
      label: 'Approved Staff',
      value: isLoadingStats && isAdmin ? '...' : approvedStaff,
      subtitle: isAdmin ? 'Active staff accounts' : 'Your approval state',
      icon: <CheckIcon />,
    },
    {
      id: 'system-status',
      label: 'System Status',
      value: 'Online',
      subtitle: 'All services operational',
      icon: <ShieldIcon />,
    },
    {
      id: 'active-users',
      label: 'Active Users',
      value: isLoadingStats && isAdmin ? '...' : activeUsers,
      subtitle: isAdmin ? 'Estimated active sessions' : 'Current session',
      icon: <PulseIcon />,
    },
  ];

  const staffMainContent = (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/35 backdrop-blur-sm sm:p-6">
      <h2 className="text-lg font-semibold text-white">Account Overview</h2>
      <p className="mt-2 text-sm text-slate-300">
        {user?.isApproved
          ? 'Your staff account is approved and fully active.'
          : 'Your registration is pending admin approval. You will receive access after verification.'}
      </p>
      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-300">
        Keep your profile information up to date and contact an administrator if approval takes longer than expected.
      </div>
    </section>
  );

  const sidePanel = (
    <>
      <ProfileCard name={user?.name} email={user?.email} role={user?.role || 'staff'} isApproved={user?.isApproved} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/35 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={!isAdmin || isLoadingStats}
            className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoadingStats && isAdmin ? 'Refreshing...' : 'Refresh Dashboard'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            Go to Login
          </button>
        </div>
      </section>
    </>
  );

  return (
    <>
      <DashboardLayout
        header={<Header username={user?.name} role={isAdmin ? 'admin' : 'staff'} onLogout={handleLogout} />}
        kpis={<KPICards items={kpis} />}
        mainContent={
          isAdmin ? (
            <ApprovalSection
              users={pendingUsers}
              isLoading={loadingPending}
              processingId={processingId}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ) : (
            staffMainContent
          )
        }
        sidePanel={sidePanel}
      />

      <div className="fixed right-4 top-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${
                toast.type === 'success'
                  ? 'border-emerald-400/35 bg-emerald-500/20 text-emerald-100'
                  : 'border-rose-400/35 bg-rose-500/20 text-rose-100'
              }`}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};
