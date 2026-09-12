import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type DashboardReportMode = 'monthly' | 'daily';

export interface MonthlyPoint {
  month: string;
  label: string;
  activeMembers: number;
  revenue: number;
  cardRevenue: number;
  bankTransferRevenue: number;
  cashRevenue: number;
  newSignups: number;
  deactivatedMemberships: number;
  cardPayments: number;
  bankTransferPayments: number;
  bankTransferPending: number;
  cashPayments: number;
  cashPending: number;
}

interface DashboardStatsResponse {
  monthlyStats: MonthlyPoint[];
  dailyStats: MonthlyPoint[];
}

export async function getMonthlyStats(
  monthsBack = 12,
  reportMode: DashboardReportMode = 'monthly',
): Promise<MonthlyPoint[]> {
  const callable = httpsCallable(functions, 'getDashboardStats');
  const response = await callable({ monthsBack, reportMode });
  const data = response.data as DashboardStatsResponse;
  const stats = reportMode === 'daily' ? data.dailyStats : data.monthlyStats;
  return stats ?? [];
}
