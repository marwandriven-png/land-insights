import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_SHEETS_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    if (!GOOGLE_SHEETS_API_KEY) {
      throw new Error('GOOGLE_SHEETS_API_KEY is not configured');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Helper: extract spreadsheet ID from full URL or raw ID
    const extractSpreadsheetId = (input: string): string => {
      if (!input) return '';
      const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
      // Already a raw ID
      return input.trim();
    };

    if (action === 'lookup') {
      // Lookup plot numbers in a Google Sheet
      const body = await req.json();
      const { spreadsheetId: rawSheetId, sheetName, plotNumbers } = body;
      const spreadsheetId = extractSpreadsheetId(rawSheetId);

      if (!spreadsheetId || !plotNumbers || !Array.isArray(plotNumbers)) {
        return new Response(JSON.stringify({ error: 'spreadsheetId and plotNumbers[] required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const range = sheetName ? `${sheetName}!A:Z` : 'Sheet1!A:Z';
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${GOOGLE_SHEETS_API_KEY}`;

      console.log(`Fetching Google Sheet: ${spreadsheetId}, range: ${range}`);

      const response = await fetch(sheetsUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Google Sheets API error:', response.status, errText);
        throw new Error(`Google Sheets API returned ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length === 0) {
        return new Response(JSON.stringify({ matches: [], headers: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // First row = headers
      const headers = rows[0].map((h: string) => h?.toString().trim().toLowerCase() || '');
      
      // Find the plot number column (try common names)
      const plotColNames = ['plot number', 'plotnumber', 'plot_number', 'plot no', 'plot', 'land number', 'land_number'];
      let plotColIndex = headers.findIndex((h: string) => plotColNames.includes(h));
      if (plotColIndex === -1) plotColIndex = 0; // default to first column

      // Find owner reference column
      const ownerColNames = ['owner reference', 'owner_reference', 'ownerreference', 'owner ref', 'owner id', 'owner_id', 'reference', 'ref'];
      const ownerColIndex = headers.findIndex((h: string) => ownerColNames.includes(h));

      // Normalize plot numbers for comparison
      const normalizedLookups = plotNumbers.map((pn: string) => pn.toString().replace(/[^0-9a-zA-Z_-]/g, '').toLowerCase());

      const matches: Record<string, Record<string, string>> = {};

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cellValue = (row[plotColIndex] || '').toString().replace(/[^0-9a-zA-Z_-]/g, '').toLowerCase();
        
        const matchIndex = normalizedLookups.indexOf(cellValue);
        if (matchIndex !== -1) {
          const plotNum = plotNumbers[matchIndex];
          const rowData: Record<string, string> = {};
          headers.forEach((header: string, colIdx: number) => {
            if (row[colIdx] !== undefined && row[colIdx] !== null) {
              rowData[header || `col_${colIdx}`] = row[colIdx].toString();
            }
          });
          if (ownerColIndex !== -1 && row[ownerColIndex]) {
            rowData['owner_reference'] = row[ownerColIndex].toString();
          }
          matches[plotNum] = rowData;
        }
      }

      return new Response(JSON.stringify({
        matches,
        headers: rows[0],
        totalRows: rows.length - 1
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'test') {
      // Test connectivity with a spreadsheet
      const body = await req.json();
      const spreadsheetId = extractSpreadsheetId(body.spreadsheetId);

      if (!spreadsheetId) {
        return new Response(JSON.stringify({ error: 'spreadsheetId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${GOOGLE_SHEETS_API_KEY}&fields=properties.title,sheets.properties.title`;

      console.log('Testing spreadsheet access, extracted ID:', spreadsheetId);

      const response = await fetch(sheetsUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Google Sheets test error:', response.status, errText);
        throw new Error(`Google Sheets API returned ${response.status}: ${errText}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify({
        connected: true,
        title: data.properties?.title,
        sheets: data.sheets?.map((s: { properties?: { title?: string } }) => s.properties?.title) || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: lookup or test' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Google Sheets Proxy Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
