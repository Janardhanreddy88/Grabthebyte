import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, IndianRupee, Building2, Tag, Calendar, Receipt } from 'lucide-react';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { format } from 'date-fns';

interface OrderDiscountLog {
  id: string;
  order_number: string;
  created_at: string;
  discount_amount: number;
  promo_code: string;
  total: number;
  campus_name: string;
  campus_code: string;
}

interface CampusAggregate {
  campus_id: string;
  campus_name: string;
  campus_code: string;
  total_owed: number;
  total_orders: number;
}

// 🦅 NEW: Interface to track debt per specific Promo Code
interface OfferAggregate {
  promo_code: string;
  total_owed: number;
  total_uses: number;
}

export function OfferSettlements() {
  const { toast } = useToast();
  const { campuses } = useSuperAdmin();
  
  const [logs, setLogs] = useState<OrderDiscountLog[]>([]);
  const [aggregates, setAggregates] = useState<CampusAggregate[]>([]);
  const [offerAggregates, setOfferAggregates] = useState<OfferAggregate[]>([]); // 🦅 NEW STATE
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    fetchDiscountData();
  }, [timeframe]);

  const fetchDiscountData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, created_at, discount_amount, promo_code, total, campus_id,
          campuses (name, code)
        `)
        .eq('discount_sponsor', 'platform')
        .in('status', ['confirmed', 'collected']) 
        .gt('discount_amount', 0)
        .order('created_at', { ascending: false });

      const now = new Date();
      if (timeframe === 'today') {
        now.setHours(0, 0, 0, 0);
        query = query.gte('created_at', now.toISOString());
      } else if (timeframe === 'week') {
        now.setDate(now.getDate() - 7);
        query = query.gte('created_at', now.toISOString());
      } else if (timeframe === 'month') {
        now.setDate(now.getDate() - 30);
        query = query.gte('created_at', now.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedLogs: OrderDiscountLog[] = [];
      const aggMap: Record<string, CampusAggregate> = {};
      const offerMap: Record<string, OfferAggregate> = {}; // 🦅 NEW AGGREGATION MAP

      (data || []).forEach((row: any) => {
        // 1. Build Detailed Log
        formattedLogs.push({
          id: row.id,
          order_number: row.order_number,
          created_at: row.created_at,
          discount_amount: row.discount_amount || 0,
          promo_code: row.promo_code || 'UNKNOWN',
          total: row.total,
          campus_name: row.campuses?.name || 'Unknown',
          campus_code: row.campuses?.code || 'UNK',
        });

        // 2. Build Campus Aggregates
        const cId = row.campus_id;
        if (!aggMap[cId]) {
          aggMap[cId] = {
            campus_id: cId,
            campus_name: row.campuses?.name || 'Unknown',
            campus_code: row.campuses?.code || 'UNK',
            total_owed: 0,
            total_orders: 0,
          };
        }
        aggMap[cId].total_owed += (row.discount_amount || 0);
        aggMap[cId].total_orders += 1;

        // 🦅 3. NEW: Build Offer/Promo Code Aggregates
        const pCode = row.promo_code || 'UNKNOWN';
        if (!offerMap[pCode]) {
          offerMap[pCode] = {
            promo_code: pCode,
            total_owed: 0,
            total_uses: 0,
          };
        }
        offerMap[pCode].total_owed += (row.discount_amount || 0);
        offerMap[pCode].total_uses += 1;
      });

      setLogs(formattedLogs);
      setAggregates(Object.values(aggMap).sort((a, b) => b.total_owed - a.total_owed));
      setOfferAggregates(Object.values(offerMap).sort((a, b) => b.total_owed - a.total_owed)); // 🦅 SAVE OFFER DATA

    } catch (error: any) {
      toast({ title: 'Data Fetch Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const totalPlatformDebt = aggregates.reduce((sum, agg) => sum + agg.total_owed, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Receipt className="text-blue-600" /> Platform Offer Payouts
          </h1>
          <p className="text-slate-500 text-sm mt-1">Track exactly how much GrabTheByte owes canteens for platform-sponsored discounts.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {(['today', 'week', 'month', 'all'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${timeframe === t ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          {/* Master KPI Card */}
          <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 border-none shadow-xl text-white">
            <CardContent className="p-8 flex items-center justify-between">
              <div>
                <p className="text-blue-100 font-bold uppercase tracking-wider text-sm mb-2">Total Platform Debt ({timeframe})</p>
                <div className="text-5xl font-black flex items-center gap-1">
                  ₹{totalPlatformDebt.toFixed(2)}
                </div>
                <p className="text-blue-200 text-sm mt-2">This is the amount GrabTheByte must pay to canteen owners for running promotions.</p>
              </div>
              <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center hidden md:flex">
                <IndianRupee className="w-12 h-12 text-blue-100" />
              </div>
            </CardContent>
          </Card>

          {/* 🦅 NEW: Promo Code Breakdown */}
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-4">Debt by Campaign (Promo Code)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {offerAggregates.length === 0 ? (
              <div className="col-span-full bg-slate-50 p-6 rounded-xl text-center text-slate-500 font-medium border border-dashed border-slate-200">
                No active campaigns in this timeframe.
              </div>
            ) : (
              offerAggregates.map((agg) => (
                <Card key={agg.promo_code} className="shadow-sm border-slate-200 hover:border-emerald-300 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <Tag className="w-4 h-4 text-emerald-500" />
                        {agg.promo_code}
                      </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mb-1">
                      ₹{agg.total_owed.toFixed(2)}
                    </div>
                    <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 w-max px-2 py-1 rounded-md">
                      Used {agg.total_uses} times
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Campus Breakdown */}
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-4">Canteen Payout Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aggregates.length === 0 ? (
              <div className="col-span-full bg-slate-50 p-8 rounded-xl text-center text-slate-500 font-medium border border-dashed border-slate-200">
                No platform-sponsored discounts used in this timeframe.
              </div>
            ) : (
              aggregates.map((agg) => (
                <Card key={agg.campus_id} className="shadow-sm border-slate-200 hover:border-blue-300 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {agg.campus_name}
                      </div>
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{agg.campus_code}</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 mb-1">
                      ₹{agg.total_owed.toFixed(2)}
                    </div>
                    <p className="text-xs font-semibold text-blue-600 bg-blue-50 w-max px-2 py-1 rounded-md">
                      Across {agg.total_orders} discounted orders
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Individual Order Logs */}
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-4">Detailed Transaction Log</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No discount logs found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4">Order ID & Date</th>
                      <th className="px-6 py-4">Canteen</th>
                      <th className="px-6 py-4">Promo Code Used</th>
                      <th className="px-6 py-4">Student Paid</th>
                      <th className="px-6 py-4 text-right">GrabTheByte Owes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">#{log.order_number}</div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {format(new Date(log.created_at), 'PP p')}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700">{log.campus_name}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <Tag className="w-3 h-3" /> {log.promo_code}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-600">₹{log.total.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                            + ₹{log.discount_amount.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}