import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Parse service account JSON and create a JWT for Google API auth
async function getAccessToken(): Promise<string> {
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!saJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured');

  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  // Import the private key and sign
  const pemContents = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c: string) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsignedToken));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${unsignedToken}.${sig}`;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Failed to get access token: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

const extractSpreadsheetId = (input: string): string => {
  if (!input) return '';
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return input.trim();
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

    if (action === 'lookup') {
      const body = await req.json();
      const { spreadsheetId: rawSheetId, sheetName, plotNumbers } = body;
      const spreadsheetId = extractSpreadsheetId(rawSheetId);

      if (!spreadsheetId || !plotNumbers || !Array.isArray(plotNumbers)) {
        return new Response(JSON.stringify({ error: 'spreadsheetId and plotNumbers[] required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let detectedSheetName = sheetName || '';
      
      // If no sheet name provided, auto-detect first sheet (use exact name, don't trim)
      if (!detectedSheetName.trim()) {
        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${GOOGLE_SHEETS_API_KEY}&fields=sheets.properties.title`;
        const metaRes = await fetch(metaUrl, { headers: { 'Accept': 'application/json' } });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          detectedSheetName = metaData.sheets?.[0]?.properties?.title || 'Sheet1';
          console.log(`Auto-detected sheet name: "${detectedSheetName}"`);
        } else {
          detectedSheetName = 'Sheet1';
        }
      }
      
      const range = `'${detectedSheetName}'!A:Z`;
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

      const headers = rows[0].map((h: string) => h?.toString().trim().toLowerCase() || '');
      
      const plotColNames = ['land number', 'land_number', 'municipality', 'plot number', 'plotnumber', 'plot_number', 'plot no', 'plot', 'p-number', 'pnumber', 'p number'];
      let plotColIndex = headers.findIndex((h: string) => plotColNames.includes(h.trim()));
      if (plotColIndex === -1) plotColIndex = headers.findIndex((h: string) => h.includes('land number'));
      if (plotColIndex === -1) plotColIndex = headers.findIndex((h: string) => h.includes('municipality') || h.includes('plot') || h.includes('land'));
      if (plotColIndex === -1) plotColIndex = 0;

      const ownerColNames = ['owner reference', 'owner_reference', 'ownerreference', 'owner ref', 'owner id', 'owner_id', 'reference', 'ref', 'owner', 'owner name', 'name'];
      let ownerColIndex = headers.findIndex((h: string) => ownerColNames.includes(h));
      if (ownerColIndex === -1) ownerColIndex = headers.findIndex((h: string) => h.includes('owner'));
      if (ownerColIndex === -1) ownerColIndex = headers.findIndex((h: string) => h === 'name');

      const normalize = (v: string) => v.toString().replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
      const normalizedLookups = plotNumbers.map((pn: string) => normalize(pn));

      console.log(`Headers: [${headers.join(', ')}]`);
      console.log(`Plot col: "${headers[plotColIndex]}" (${plotColIndex}), Owner col: "${ownerColIndex >= 0 ? headers[ownerColIndex] : 'none'}" (${ownerColIndex})`);
      console.log(`Looking up ${plotNumbers.length} plots: ${plotNumbers.slice(0, 5).join(', ')}`);

      const matches: Record<string, Record<string, string>> = {};

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cellValue = normalize((row[plotColIndex] || '').toString());
        
        let matchIndex = normalizedLookups.indexOf(cellValue);
        
        if (matchIndex === -1) {
          for (let c = 0; c < row.length; c++) {
            if (c === plotColIndex) continue;
            const altValue = normalize((row[c] || '').toString());
            matchIndex = normalizedLookups.indexOf(altValue);
            if (matchIndex !== -1) {
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
      const body = await req.json();
      const spreadsheetId = extractSpreadsheetId(body.spreadsheetId);

      if (!spreadsheetId) {
        return new Response(JSON.stringify({ error: 'spreadsheetId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${GOOGLE_SHEETS_API_KEY}&fields=properties.title,sheets.properties.title`;

      const response = await fetch(sheetsUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        const errText = await response.text();
        if (errText.includes('FAILED_PRECONDITION') || errText.includes('not supported for this document')) {
          return new Response(JSON.stringify({ 
            error: 'This file is not a native Google Sheet. Please use File → Save as Google Sheets.' 
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

    // --- WRITE ACTIONS (using Service Account) ---

    if (action === 'append') {
      // Append new rows to the sheet
      const body = await req.json();
      const { spreadsheetId: rawSheetId, sheetName, rows: newRows } = body;
      const spreadsheetId = extractSpreadsheetId(rawSheetId);

      if (!spreadsheetId || !newRows || !Array.isArray(newRows) || newRows.length === 0) {
        return new Response(JSON.stringify({ error: 'spreadsheetId and rows[] required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const accessToken = await getAccessToken();
      const trimmedSheetName = sheetName?.trim() || 'Sheet1';
      const range = `'${trimmedSheetName}'!A:Z`;

      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

      console.log(`Appending ${newRows.length} rows to ${spreadsheetId}, sheet: ${trimmedSheetName}`);

      const response = await fetch(sheetsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: newRows }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Google Sheets append error:', response.status, errText);
        throw new Error(`Google Sheets API returned ${response.status}: ${errText}`);
      }

      const result = await response.json();
      console.log(`Appended ${result.updates?.updatedRows || 0} rows`);

      return new Response(JSON.stringify({
        success: true,
        updatedRows: result.updates?.updatedRows || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'update') {
      // Update specific rows by plot number
      const body = await req.json();
      const { spreadsheetId: rawSheetId, sheetName, updates } = body;
      // updates: Array<{ plotNumber: string, data: Record<string, string> }>
      const spreadsheetId = extractSpreadsheetId(rawSheetId);

      if (!spreadsheetId || !updates || !Array.isArray(updates)) {
        return new Response(JSON.stringify({ error: 'spreadsheetId and updates[] required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const accessToken = await getAccessToken();
      const trimmedSheetName = sheetName?.trim() || 'Sheet1';
      const readRange = `'${trimmedSheetName}'!A:Z`;

      // First read existing data to find row indices
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(readRange)}?key=${GOOGLE_SHEETS_API_KEY}`;
      const readRes = await fetch(readUrl, { headers: { 'Accept': 'application/json' } });
      if (!readRes.ok) throw new Error(`Failed to read sheet: ${await readRes.text()}`);
      
      const readData = await readRes.json();
      const allRows = readData.values || [];
      if (allRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Sheet is empty' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const headers = allRows[0].map((h: string) => h?.toString().trim().toLowerCase() || '');
      const normalize = (v: string) => v.toString().replace(/[^0-9a-zA-Z]/g, '').toLowerCase();

      // Find plot column
      const plotColNames = ['land number', 'land_number', 'plot number', 'plotnumber', 'plot_number', 'plot no', 'plot', 'p-number', 'land'];
      let plotColIndex = headers.findIndex((h: string) => plotColNames.includes(h.trim()));
      if (plotColIndex === -1) plotColIndex = 0;

      const batchData: Array<{ range: string; values: string[][] }> = [];
      let updatedCount = 0;

      for (const upd of updates) {
        const normPlot = normalize(upd.plotNumber);

        for (let i = 1; i < allRows.length; i++) {
          const row = allRows[i];
          let found = false;

          // Check plot column
          if (normalize((row[plotColIndex] || '').toString()) === normPlot) found = true;

          // Check all columns as fallback
          if (!found) {
            for (let c = 0; c < row.length; c++) {
              if (normalize((row[c] || '').toString()) === normPlot) { found = true; break; }
            }
          }

          if (found) {
            // Update specific cells in this row
            for (const [key, value] of Object.entries(upd.data)) {
              const colIdx = headers.indexOf(key.toLowerCase());
              if (colIdx !== -1) {
                const colLetter = String.fromCharCode(65 + colIdx);
                const rowNum = i + 1; // 1-indexed
                batchData.push({
                  range: `'${trimmedSheetName}'!${colLetter}${rowNum}`,
                  values: [[value as string]],
                });
              }
            }
            updatedCount++;
            break;
          }
        }
      }

      if (batchData.length > 0) {
        const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
        const batchRes = await fetch(batchUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: batchData,
          }),
        });

        if (!batchRes.ok) {
          const errText = await batchRes.text();
          console.error('Batch update error:', errText);
          throw new Error(`Batch update failed: ${errText}`);
        }
      }

      console.log(`Updated ${updatedCount} rows with ${batchData.length} cell changes`);

      return new Response(JSON.stringify({
        success: true,
        updatedRows: updatedCount,
        cellsUpdated: batchData.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: lookup, test, append, or update' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Sheets Proxy Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
