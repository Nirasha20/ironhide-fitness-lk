// pages/admin/AdminDashboardPage.tsx
import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Spinner } from '../../components/ui/Spinner';
import { getMonthlyStats, type DashboardReportMode, type MonthlyPoint } from '../../lib/analyticsService';
import { formatCurrency } from '../../lib/utils';

function escapeCsvValue(value: string | number | null | undefined): string {
  const normalized = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${normalized.replace(/"/g, '""')}"`;
}

function getMonthKeyFromDateValue(value: string): string {
  if (!value) return '';
  return value.slice(0, 7);
}

function getDayKeyFromDateValue(value: string): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function AdminDashboardContent() {
  const [data, setData] = useState<MonthlyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [reportMode, setReportMode] = useState<DashboardReportMode>('monthly');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    getMonthlyStats(12, reportMode)
      .then((d) => {
        if (!mounted) return;
        setData(d);

        if (d.length) {
          const firstValue = d[0]?.month ?? '';
          const lastValue = d[d.length - 1]?.month ?? '';
          setStartMonth((current) => current || firstValue);
          setEndMonth((current) => current || lastValue);
        }
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
  }, [reportMode]);

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const latestRevenue = Number(latest?.revenue ?? 0);
  const prevRevenue = Number(prev?.revenue ?? 0);
  const latestCardRevenue = Number(latest?.cardRevenue ?? 0);
  const prevCardRevenue = Number(prev?.cardRevenue ?? 0);
  const latestBankTransferRevenue = Number(latest?.bankTransferRevenue ?? 0);
  const prevBankTransferRevenue = Number(prev?.bankTransferRevenue ?? 0);
  const latestCashRevenue = Number(latest?.cashRevenue ?? 0);
  const prevCashRevenue = Number(prev?.cashRevenue ?? 0);
  const latestCardPayments = Number(latest?.cardPayments ?? 0);
  const latestBankTransferPayments = Number(latest?.bankTransferPayments ?? 0);
  const latestBankTransferPending = Number(latest?.bankTransferPending ?? 0);
  const latestCashPayments = Number(latest?.cashPayments ?? 0);
  const latestCashPending = Number(latest?.cashPending ?? 0);
  const latestActiveMembers = Number(latest?.activeMembers ?? 0);
  const latestNewSignups = Number(latest?.newSignups ?? 0);
  const latestDeactivatedMemberships = Number(latest?.deactivatedMemberships ?? 0);
  const revenueDelta = latestRevenue - prevRevenue;
  const cardRevenueDelta = latestCardRevenue - prevCardRevenue;
  const bankTransferRevenueDelta = latestBankTransferRevenue - prevBankTransferRevenue;
  const cashRevenueDelta = latestCashRevenue - prevCashRevenue;

  const normalizedStart = startMonth && endMonth && startMonth > endMonth ? endMonth : startMonth;
  const normalizedEnd = startMonth && endMonth && startMonth > endMonth ? startMonth : endMonth;
  const normalizedStartKey = reportMode === 'daily'
    ? getDayKeyFromDateValue(normalizedStart)
    : getMonthKeyFromDateValue(normalizedStart);
  const normalizedEndKey = reportMode === 'daily'
    ? getDayKeyFromDateValue(normalizedEnd)
    : getMonthKeyFromDateValue(normalizedEnd);

  const reportRows = !data.length || !normalizedStartKey || !normalizedEndKey
    ? []
    : data.filter((point) => point.month >= normalizedStartKey && point.month <= normalizedEndKey);

  const totalCardRevenue = reportRows.reduce((sum, row) => sum + Number(row.cardRevenue ?? 0), 0);
  const totalBankTransferRevenue = reportRows.reduce((sum, row) => sum + Number(row.bankTransferRevenue ?? 0), 0);
  const totalCashRevenue = reportRows.reduce((sum, row) => sum + Number(row.cashRevenue ?? 0), 0);
  const totalAllRevenue = reportRows.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0);

  const handleDownloadReport = () => {
    if (!reportRows.length) return;

    const headers = [
      'Period',
      'Card Revenue',
      'Bank Transfer Revenue',
      'Pay at Gym Revenue',
      'All Payments',
    ];

    const csvRows = reportRows.map((row) => [
      row.label,
      Number(row.cardRevenue ?? 0),
      Number(row.bankTransferRevenue ?? 0),
      Number(row.cashRevenue ?? 0),
      Number(row.revenue ?? 0),
    ]);

    const csvContent = [headers, ...csvRows]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const fileName = `sales-report-${normalizedStart || 'all'}-to-${normalizedEnd || 'all'}.csv`;

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-16 text-center text-error-container font-body">{error}</div>;
  if (!data.length) return <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-16 text-center text-on-surface-variant">No analytics data available yet.</div>;

  try {
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
              <p className="font-display text-headline-md mt-4 text-rose-100">{formatCurrency(latestRevenue)}</p>
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
              <p className="font-display text-headline-md mt-4 text-green-100">{latestCardPayments}</p>
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
              <p className="font-display text-headline-md mt-4 text-amber-100">{latestBankTransferPayments}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <span className="material-symbols-outlined text-base">account_balance</span>
            </div>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-3">{latestBankTransferPending > 0 ? `${latestBankTransferPending} pending review` : 'No pending transfers'}</p>
        </div>

        <div className="bg-surface-container p-4 rounded-[24px] border border-surface-container-highest shadow-lg shadow-black/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-label-sm uppercase tracking-[0.24em] text-sky-300">Pay at Gym</p>
              <p className="font-display text-headline-md mt-4 text-sky-100">{latestCashPayments}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-sky-500/10 border border-sky-500/20 text-sky-300">
              <span className="material-symbols-outlined text-base">payments</span>
            </div>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-3">{latestCashPending > 0 ? `${latestCashPending} pending review` : 'No pending cash payments'}</p>
        </div>
      </div>

      <div className="bg-surface-container p-4 rounded-[24px] border border-surface-container-highest shadow-lg shadow-black/5">
        <div className="flex flex-col gap-4 mb-4">
          <div>
            <p className="text-label-sm uppercase tracking-[0.24em] text-on-surface-variant">See All Sales</p>
            <h2 className="font-display text-headline-sm mt-2">Sales report</h2>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <label className="flex flex-col gap-2 text-body-sm text-on-surface-variant max-w-[220px]">
              <span>From</span>
              <input
                type="date"
                value={startMonth}
                onChange={(event) => setStartMonth(event.target.value)}
                className="rounded-lg border border-surface-container-highest bg-surface px-3 py-2 text-white [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-200"
              />
            </label>

            <label className="flex flex-col gap-2 text-body-sm text-on-surface-variant max-w-[220px]">
              <span>To</span>
              <input
                type="date"
                value={endMonth}
                onChange={(event) => setEndMonth(event.target.value)}
                className="rounded-lg border border-surface-container-highest bg-surface px-3 py-2 text-white [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-200"
              />
            </label>

            <label className="flex flex-col gap-2 text-body-sm text-on-surface-variant max-w-[220px]">
              <span>Report Type</span>
              <select
                value={reportMode}
                onChange={(event) => setReportMode(event.target.value as 'monthly' | 'daily')}
                className="rounded-lg border border-surface-container-highest bg-surface px-3 py-2 text-white"
              >
                <option value="monthly">Monthly Records</option>
                <option value="daily">Daily Records</option>
              </select>
            </label>

            <div className="flex flex-col gap-2 md:items-end">
              <div className="w-24 h-1 bg-primary-container" />
              <button
                type="button"
                onClick={handleDownloadReport}
                disabled={!reportRows.length}
                className="rounded-lg bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download Sales Report
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface-200 p-4 rounded-[24px] border border-surface-container-highest shadow-sm shadow-black/5">
            <p className="text-label-sm uppercase tracking-[0.24em] text-green-300">Card Payments</p>
            <p className="font-display text-headline-md mt-4 text-green-100">{formatCurrency(totalCardRevenue)}</p>
            <p className={`mt-3 text-sm font-medium ${cardRevenueDelta >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {cardRevenueDelta >= 0 ? '+' : ''}{formatCurrency(cardRevenueDelta)} vs last month
            </p>
          </div>

          <div className="bg-surface-200 p-4 rounded-[24px] border border-surface-container-highest shadow-sm shadow-black/5">
            <p className="text-label-sm uppercase tracking-[0.24em] text-amber-300">Bank Transfer</p>
            <p className="font-display text-headline-md mt-4 text-amber-100">{formatCurrency(totalBankTransferRevenue)}</p>
            <p className={`mt-3 text-sm font-medium ${bankTransferRevenueDelta >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {bankTransferRevenueDelta >= 0 ? '+' : ''}{formatCurrency(bankTransferRevenueDelta)} vs last month
            </p>
          </div>

          <div className="bg-surface-200 p-4 rounded-[24px] border border-surface-container-highest shadow-sm shadow-black/5">
            <p className="text-label-sm uppercase tracking-[0.24em] text-sky-300">Pay at Gym</p>
            <p className="font-display text-headline-md mt-4 text-sky-100">{formatCurrency(totalCashRevenue)}</p>
            <p className={`mt-3 text-sm font-medium ${cashRevenueDelta >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {cashRevenueDelta >= 0 ? '+' : ''}{formatCurrency(cashRevenueDelta)} vs last month
            </p>
          </div>

          <div className="bg-primary-container text-on-primary-container p-4 rounded-[24px] border border-primary-container shadow-lg shadow-primary-container/20">
            <p className="text-label-sm uppercase tracking-[0.24em] text-rose-100/80">All Payments</p>
            <p className="font-display text-headline-md mt-4 text-rose-100">{formatCurrency(totalAllRevenue)}</p>
            <p className={`mt-3 text-sm font-medium ${revenueDelta >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {revenueDelta >= 0 ? '+' : ''}{formatCurrency(revenueDelta)} vs last month
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[20px] border border-surface-container-highest">
          <table className="min-w-full text-left text-body-sm text-white">
            <thead className="bg-surface-200 text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Card Revenue</th>
                <th className="px-4 py-3 font-medium">Bank Transfer Revenue</th>
                <th className="px-4 py-3 font-medium">Pay at Gym Revenue</th>
                <th className="px-4 py-3 font-medium">All Payments</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.length ? reportRows.map((row) => (
                <tr key={row.month} className="border-t border-surface-container-highest">
                  <td className="px-4 py-3 text-white">{row.label}</td>
                  <td className="px-4 py-3 text-white">{formatCurrency(Number(row.cardRevenue ?? 0))}</td>
                  <td className="px-4 py-3 text-white">{formatCurrency(Number(row.bankTransferRevenue ?? 0))}</td>
                  <td className="px-4 py-3 text-white">{formatCurrency(Number(row.cashRevenue ?? 0))}</td>
                  <td className="px-4 py-3 text-white">{formatCurrency(Number(row.revenue ?? 0))}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">No sales data found for the selected period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-surface-container p-6 rounded-lg border border-surface-container-highest shadow-lg shadow-black/5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-200 p-4 rounded-[24px] border border-surface-container-highest shadow-sm shadow-black/5">
            <p className="text-label-sm uppercase tracking-[0.24em] text-emerald-300">Active Memberships</p>
            <p className="font-display text-headline-md mt-4 text-emerald-100">{latestActiveMembers}</p>
            <p className="text-body-sm text-on-surface-variant mt-3">Members active in the latest month</p>
          </div>
          <div className="bg-surface-200 p-4 rounded-[24px] border border-surface-container-highest shadow-sm shadow-black/5">
            <p className="text-label-sm uppercase tracking-[0.24em] text-violet-300">New Signups</p>
            <p className="font-display text-headline-md mt-4 text-violet-100">{latestNewSignups}</p>
            <p className="text-body-sm text-on-surface-variant mt-3">New signups during the latest month</p>
          </div>
          <div className="bg-surface-200 p-4 rounded-[24px] border border-surface-container-highest shadow-sm shadow-black/5">
            <p className="text-label-sm uppercase tracking-[0.24em] text-rose-300">Deactivated Memberships</p>
            <p className="font-display text-headline-md mt-4 text-rose-100">{latestDeactivatedMemberships}</p>
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
                  { name: 'Card Payments', value: latestCardPayments },
                  { name: 'Bank Transfers', value: latestBankTransferPayments },
                  { name: 'Pay at Gym', value: latestCashPayments },
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
  } catch (caughtError) {
    console.error('[AdminDashboardPage] Render failed:', caughtError);
    return (
      <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-16 text-center text-on-surface-variant">
        Unable to load the admin sales report right now. Please refresh the page.
      </div>
    );
  }
}

export default function AdminDashboardPage() {
  return <AdminDashboardContent />;
}