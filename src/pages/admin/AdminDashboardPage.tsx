// pages/admin/AdminDashboardPage.tsx
import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Spinner } from '../../components/ui/Spinner';
import { getMonthlyStats, type MonthlyPoint } from '../../lib/analyticsService';
import { formatCurrency } from '../../lib/utils';

function AdminDashboardContent() {
  const [data, setData] = useState<MonthlyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    getMonthlyStats(12)
      .then((d) => {
        if (!mounted) return;
        setData(d);
      })
      .catch((err) => {
        console.error('[AdminDashboardPage] getMonthlyStats failed:', err);
        if (!mounted) return;
        setError(err?.message ?? 'Unable to load dashboard analytics.');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-16 text-center text-error-container font-body">{error}</div>;
  if (!data.length) return <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-16 text-center text-on-surface-variant">No analytics data available yet.</div>;

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const revenueDelta = latest && prev ? latest.revenue - prev.revenue : 0;

  return (
    <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-12 space-y-8">
      <div>
        <h1 className="font-display text-headline-lg uppercase mb-4">DASHBOARD</h1>
        <div className="w-24 h-1 bg-primary-container" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-primary-container text-on-primary-container p-4 rounded-[24px] border border-primary-container shadow-lg shadow-primary-container/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-label-sm uppercase tracking-[0.24em] text-rose-100/80">Revenue</p>
              <p className="font-display text-headline-md mt-4 text-rose-100">{formatCurrency(latest.revenue)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-on-primary-container/10 text-rose-100">
              <span className="material-symbols-outlined text-base">currency_rupee</span>
            </div>
          </div>
          <p className="text-body-sm text-on-primary-container/85 mt-3">Active + approved payments</p>
          <p className={`mt-3 text-sm font-medium ${revenueDelta >= 0 ? 'text-green-200' : 'text-red-200'}`}>
            {revenueDelta >= 0 ? '+' : ''}{formatCurrency(revenueDelta)} vs last month
          </p>
        </div>

        <div className="bg-surface-container p-4 rounded-[24px] border border-surface-container-highest shadow-lg shadow-black/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-label-sm uppercase tracking-[0.24em] text-green-300">Card Payments</p>
              <p className="font-display text-headline-md mt-4 text-green-100">{latest.cardPayments}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-green-500/10 border border-green-500/20 text-green-300">
              <span className="material-symbols-outlined text-base">credit_card</span>
            </div>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-3">Auto-activated payments</p>
        </div>

        <div className="bg-surface-container p-4 rounded-[24px] border border-surface-container-highest shadow-lg shadow-black/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-label-sm uppercase tracking-[0.24em] text-amber-300">Bank Transfers</p>
              <p className="font-display text-headline-md mt-4 text-amber-100">{latest.bankTransferPayments}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <span className="material-symbols-outlined text-base">account_balance</span>
            </div>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-3">{latest.bankTransferPending > 0 ? `${latest.bankTransferPending} pending review` : 'No pending transfers'}</p>
        </div>

        <div className="bg-surface-container p-4 rounded-[24px] border border-surface-container-highest shadow-lg shadow-black/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-label-sm uppercase tracking-[0.24em] text-sky-300">Pay at Gym</p>
              <p className="font-display text-headline-md mt-4 text-sky-100">{latest.cashPayments}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-sky-500/10 border border-sky-500/20 text-sky-300">
              <span className="material-symbols-outlined text-base">payments</span>
            </div>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-3">{latest.cashPending > 0 ? `${latest.cashPending} pending review` : 'No pending cash payments'}</p>
        </div>
      </div>

      <div className="bg-surface-container p-6 rounded-lg border border-surface-container-highest shadow-lg shadow-black/5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-200 p-4 rounded-[24px] border border-surface-container-highest shadow-sm shadow-black/5">
            <p className="text-label-sm uppercase tracking-[0.24em] text-emerald-300">Active Memberships</p>
            <p className="font-display text-headline-md mt-4 text-emerald-100">{latest.activeMembers}</p>
            <p className="text-body-sm text-on-surface-variant mt-3">Members active in the latest month</p>
          </div>
          <div className="bg-surface-200 p-4 rounded-[24px] border border-surface-container-highest shadow-sm shadow-black/5">
            <p className="text-label-sm uppercase tracking-[0.24em] text-violet-300">New Signups</p>
            <p className="font-display text-headline-md mt-4 text-violet-100">{latest.newSignups}</p>
            <p className="text-body-sm text-on-surface-variant mt-3">New signups during the latest month</p>
          </div>
          <div className="bg-surface-200 p-4 rounded-[24px] border border-surface-container-highest shadow-sm shadow-black/5">
            <p className="text-label-sm uppercase tracking-[0.24em] text-rose-300">Deactivated Memberships</p>
            <p className="font-display text-headline-md mt-4 text-rose-100">{latest.deactivatedMemberships}</p>
            <p className="text-body-sm text-on-surface-variant mt-3">Memberships expired or rejected this month</p>
          </div>
        </div>

        <div className="bg-surface-container p-4 rounded-[24px] border border-surface-container-highest shadow-lg shadow-black/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-label-sm uppercase tracking-[0.24em] text-on-surface-variant">Payment Method Share</p>
              <h3 className="font-display text-headline-sm mt-2">Card / Bank / Gym</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Card Payments', value: latest.cardPayments },
                  { name: 'Bank Transfers', value: latest.bankTransferPayments },
                  { name: 'Pay at Gym', value: latest.cashPayments },
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={90}
                paddingAngle={2}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {['#4ade80', '#fbbf24', '#38bdf8'].map((fill) => (
                  <Cell key={fill} fill={fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value ?? ''}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-1 gap-2 mt-4">
            <div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
              <span className="h-2.5 w-2.5 rounded-full bg-green-300" /> Card Payments
            </div>
            <div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Bank Transfers
            </div>
            <div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Pay at Gym
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container p-6 rounded-lg">
          <h2 className="font-display text-headline-sm uppercase mb-4">Active Memberships</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#cbd5e1' }} axisLine={{ stroke: '#475569' }} tickLine={{ stroke: '#475569' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#cbd5e1' }} axisLine={{ stroke: '#475569' }} tickLine={{ stroke: '#475569' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }} />
              <Line type="monotone" dataKey="activeMembers" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#38bdf8' }} activeDot={{ r: 6, fill: '#22c55e' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface-container p-6 rounded-lg">
          <h2 className="font-display text-headline-sm uppercase mb-4">Revenue (LKR)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#cbd5e1' }} axisLine={{ stroke: '#475569' }} tickLine={{ stroke: '#475569' }} />
              <YAxis label={{ value: 'Revenue (LKR)', angle: -90, position: 'insideLeft', offset: -10, fill: '#cbd5e1', style: { fontSize: 12 } }} tickFormatter={(value) => Number(value).toLocaleString()} tick={{ fontSize: 12, fill: '#cbd5e1' }} axisLine={{ stroke: '#475569' }} tickLine={{ stroke: '#475569' }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="revenue" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return <AdminDashboardContent />;
}