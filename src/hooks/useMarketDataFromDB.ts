import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DBProjectComparable {
  name: string;
  developer: string | null;
  area: string;
  areaCode: string;
  plotSqft: number | null;
  units: number | null;
  floors: string | null;
  handover: string | null;
  psf: number | null;
  studioP: number;
  br1P: number;
  br2P: number;
  br3P: number;
  payPlan: string | null;
  svc: number | null;
  priceFrom: number | null;
}

export interface DBMarketSnapshot {
  areaCode: string;
  areaName: string;
  salesTxns: number | null;
  studioPsfAvg: number | null;
  oneBrPsfAvg: number | null;
  twoBrPsfAvg: number | null;
  threeBrPsfAvg: number | null;
  rentalContracts: number | null;
  avgRentPsfYr: number | null;
  grossYieldEst: number | null;
}

export function useDBComparables(areaCode: string | null) {
  return useQuery({
    queryKey: ['db-comparables', areaCode],
    queryFn: async (): Promise<DBProjectComparable[]> => {
      if (!areaCode) return [];

      const { data, error } = await supabase
        .from('v_project_unit_summary')
        .select('*')
        .eq('area_code', areaCode);

      if (error) { console.error('DB comparables error:', error); return []; }
      if (!data?.length) return [];

      // Group by project
      const projectMap = new Map<string, DBProjectComparable>();
      for (const row of data) {
        const key = row.project_name || '';
        if (!projectMap.has(key)) {
          // Compute avg PSF from unit mixes
          const psfVals = [row.psf_min_aed, row.psf_max_aed].filter((v): v is number => v != null && v > 0);
          projectMap.set(key, {
            name: key,
            developer: row.developer,
            area: row.area_name || '',
            areaCode: row.area_code || '',
            plotSqft: null, // Will be set from project-level data
            units: row.total_units,
            floors: null,
            handover: row.completion_quarter,
            psf: psfVals.length ? Math.round(psfVals.reduce((a, b) => a + b, 0) / psfVals.length) : null,
            studioP: 0, br1P: 0, br2P: 0, br3P: 0,
            payPlan: row.payment_on_booking != null ? `${row.payment_on_booking}/${100 - (row.payment_on_booking || 0) - (row.payment_post_ho || 0)}/${row.payment_post_ho || 0}` : null,
            svc: row.service_charge_psf ? Number(row.service_charge_psf) : null,
            priceFrom: row.price_from_aed ? Number(row.price_from_aed) : null,
          });
        }

        const proj = projectMap.get(key)!;
        const pct = Number(row.pct_of_total) || 0;
        const code = row.type_code;
        if (code === 'STUDIO') proj.studioP = pct;
        else if (code === '1BR') proj.br1P = pct;
        else if (code === '2BR') proj.br2P = pct;
        else if (code === '3BR') proj.br3P = pct;

        // Update PSF if this row has better data
        if (!proj.psf && row.psf_min_aed) {
          const vals = [row.psf_min_aed, row.psf_max_aed].filter((v): v is number => v != null && v > 0);
          if (vals.length) proj.psf = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        }
      }

      return Array.from(projectMap.values());
    },
    enabled: !!areaCode,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDBMarketSnapshot(areaCode: string | null) {
  return useQuery({
    queryKey: ['db-market-snapshot', areaCode],
    queryFn: async (): Promise<DBMarketSnapshot | null> => {
      if (!areaCode) return null;

      const { data, error } = await supabase
        .from('v_area_snapshot_latest')
        .select('*')
        .eq('area_code', areaCode)
        .limit(1);

      if (error || !data?.length) return null;

      const row = data[0];
      return {
        areaCode: row.area_code || '',
        areaName: row.area_name || '',
        salesTxns: row.sales_txns_total,
        studioPsfAvg: row.studio_psf_avg ? Number(row.studio_psf_avg) : null,
        oneBrPsfAvg: row.one_br_psf_avg ? Number(row.one_br_psf_avg) : null,
        twoBrPsfAvg: row.two_br_psf_avg ? Number(row.two_br_psf_avg) : null,
        threeBrPsfAvg: null, // Not in view currently
        rentalContracts: row.rental_contracts,
        avgRentPsfYr: row.avg_rent_psf_yr ? Number(row.avg_rent_psf_yr) : null,
        grossYieldEst: row.gross_yield_est ? Number(row.gross_yield_est) : null,
      };
    },
    enabled: !!areaCode,
    staleTime: 5 * 60 * 1000,
  });
}
