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
      
      // Find the plot number column (try common names with flexible matching)
      // Priority: 'land number' first since it contains the actual GIS plot IDs
      const plotColNames = ['land number', 'land_number', 'municipality', 'plot number', 'plotnumber', 'plot_number', 'plot no', 'plot', 'p-number', 'pnumber', 'p number'];
      let plotColIndex = headers.findIndex((h: string) => plotColNames.includes(h.trim()));
      // Fallback: find column containing 'land number' first, then 'municipality', 'plot'
      if (plotColIndex === -1) plotColIndex = headers.findIndex((h: string) => h.includes('land number'));
      if (plotColIndex === -1) plotColIndex = headers.findIndex((h: string) => h.includes('municipality') || h.includes('plot') || h.includes('land'));
      if (plotColIndex === -1) plotColIndex = 0; // default to first column

      // Find owner/name column (flexible)
      const ownerColNames = ['owner reference', 'owner_reference', 'ownerreference', 'owner ref', 'owner id', 'owner_id', 'reference', 'ref', 'owner', 'owner name', 'name'];
      let ownerColIndex = headers.findIndex((h: string) => ownerColNames.includes(h));
      // Fallback: find column containing 'owner' or 'name'
      if (ownerColIndex === -1) ownerColIndex = headers.findIndex((h: string) => h.includes('owner'));
      if (ownerColIndex === -1) ownerColIndex = headers.findIndex((h: string) => h === 'name');

      // Normalize: strip everything except alphanumeric chars for comparison
      const normalize = (v: string) => v.toString().replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
      const normalizedLookups = plotNumbers.map((pn: string) => normalize(pn));

      console.log(`Headers found: [${headers.join(', ')}]`);
      console.log(`Plot column: "${headers[plotColIndex]}" (idx ${plotColIndex}), Owner column: "${ownerColIndex >= 0 ? headers[ownerColIndex] : 'none'}" (idx ${ownerColIndex})`);
      console.log(`Looking up ${plotNumbers.length} plot numbers: ${plotNumbers.slice(0, 5).join(', ')}`);

      const matches: Record<string, Record<string, string>> = {};

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cellValue = normalize((row[plotColIndex] || '').toString());
        
        let matchIndex = normalizedLookups.indexOf(cellValue);
        
        // Fallback: search ALL columns in this row for a match
        let actualMatchCol = plotColIndex;
        if (matchIndex === -1) {
          for (let c = 0; c < row.length; c++) {
            if (c === plotColIndex) continue;
            const altValue = normalize((row[c] || '').toString());
            matchIndex = normalizedLookups.indexOf(altValue);
            if (matchIndex !== -1) {
              actualMatchCol = c;
              break;
            }
          }
        }

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
          if (actualMatchCol !== plotColIndex) {
            console.log(`Row ${i}: matched "${plotNum}" via column "${headers[actualMatchCol]}" (idx ${actualMatchCol}) instead of primary column`);
          }
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
        
        // Check if this is a non-native Google Sheet (e.g. uploaded Excel)
        if (errText.includes('FAILED_PRECONDITION') || errText.includes('not supported for this document')) {
          return new Response(JSON.stringify({ 
            error: 'This file is not a native Google Sheet. Please open it in Google Drive, then go to File → Save as Google Sheets, and use the new URL instead.' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
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
