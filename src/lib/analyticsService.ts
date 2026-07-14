import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface MonthlyPoint {
  month: string;
  label: string;
  activeMembers: number;
  revenue: number;
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
}

export async function getMonthlyStats(monthsBack = 12): Promise<MonthlyPoint[]> {
  const callable = httpsCallable(functions, 'getDashboardStats');
  const response = await callable({ monthsBack });
  const data = response.data as DashboardStatsResponse;
  return data.monthlyStats ?? [];
}
