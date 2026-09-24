import { useMemo } from "react";
import { DashboardStats, DashboardBucket } from "./useQueryData";
import { differenceInDays } from "date-fns";

export function useDashboardStatsFormatter(
  stats: DashboardStats | undefined,
  rangeStart: Date,
  rangeEnd: Date,
  bucket: DashboardBucket
) {
  return useMemo(() => {
    const cur = stats?.current;
    
    const rate = (a?: number, t?: number) => (t && t > 0 ? ((a ?? 0) / t) * 100 : 0);

    const approvedCount = Number(cur?.approved_count ?? 0);
    const revenue = Number(cur?.revenue ?? 0);
    const uniqueCustomers = Number(cur?.unique_customers ?? 0);
    const conversion = rate(cur?.approved_count, cur?.total_count);
    const pixConversion = rate(cur?.pix_approved, cur?.pix_total);
    const cardConversion = rate(cur?.card_approved, cur?.card_total);
    const boletoConversion = rate(cur?.boleto_approved, cur?.boleto_total);
    const chargebackRate = rate(cur?.chargeback_count, cur?.total_count);
    
    const pendingBalance = Number(stats?.global?.pending_balance ?? 0);
    const receivedToday = Number(stats?.global?.received_today ?? 0);
    const disputedAmount = Number(stats?.global?.disputed_amount ?? 0);
    
    const prevApprovedCount = Number(stats?.previous?.approved_count ?? 0);
    const prevRevenue = Number(stats?.previous?.revenue ?? 0);

    const pctChange = (curr: number, prev: number): number | undefined => {
      if (prev === 0) return curr === 0 ? 0 : undefined;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const ordersTrend = pctChange(approvedCount, prevApprovedCount);
    const revenueTrend = pctChange(revenue, prevRevenue);

    // Chart Data logic
    const byKey = new Map<string, number>();
    (stats?.series ?? []).forEach((point) => {
      const raw = String(point.bucket);
      byKey.set(raw.slice(0, 13), (byKey.get(raw.slice(0, 13)) || 0) + Number(point.revenue));
    });
    
    const pad = (n: number) => String(n).padStart(2, "0");
    const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    
    const spanDays = differenceInDays(rangeEnd, rangeStart) + 1;

    let chartData: any[] = [];
    if (bucket === "hour") {
      chartData = Array.from({ length: 24 }, (_, i) => {
        const point = new Date(rangeStart);
        point.setHours(i, 0, 0, 0);
        return {
          name: `${i}h`,
          vendas: byKey.get(`${dayKey(point)}T${pad(i)}`) || 0,
          fullLabel: `${i}:00`,
          timestamp: point.getTime(),
          granularity: "hour",
        };
      });
    } else if (bucket === "month") {
      const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      const last = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
      while (cursor <= last) {
        chartData.push({
          name: cursor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          vendas: byKey.get(`${dayKey(cursor)}T00`) || 0,
          fullLabel: cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
          timestamp: cursor.getTime(),
          granularity: "month",
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      chartData = Array.from({ length: spanDays }, (_, i) => {
        const d = new Date(rangeStart);
        d.setDate(d.getDate() + i);
        return {
          name: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          vendas: byKey.get(`${dayKey(d)}T00`) || 0,
          fullLabel: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }),
          timestamp: d.getTime(),
          granularity: "day",
        };
      });
    }

    return {
      approvedCount,
      revenue,
      uniqueCustomers,
      conversion,
      pixConversion,
      cardConversion,
      boletoConversion,
      chargebackRate,
      pendingBalance,
      receivedToday,
      disputedAmount,
      ordersTrend,
      revenueTrend,
      chartData
    };
  }, [stats, rangeStart, rangeEnd, bucket]);
}
