// Service for syncing listing data to/from Google Sheets

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getSheetConfig() {
  const sheetUrl = localStorage.getItem('hp_sheetId') || localStorage.getItem('hyperplot_sheet_url') || '';
  const dataSheetName = localStorage.getItem('hp_sheetName') || '';
  return { sheetUrl, dataSheetName };
}

// The LISTING sheet is where listings are written/synced
const LISTING_SHEET_NAME = 'DATA BASE';

export async function syncListingToSheet(plotNumber: string, data: {
  owner?: string;
  contact?: string;
  status?: string;
  price?: string;
  notes?: string;
  area?: string;
}): Promise<boolean> {
  const { sheetUrl } = getSheetConfig();
  if (!sheetUrl) {
    console.log('No Google Sheet configured, skipping sync');
    return false;
  }

  try {
    // Map fields to LISTING sheet column names
    const updateData: Record<string, string> = {};
    if (data.owner) updateData['owner'] = data.owner;
    if (data.contact) updateData['contact'] = data.contact;
    if (data.status) updateData['status'] = data.status;
    if (data.price) updateData['price'] = data.price;
    if (data.notes) updateData['notes'] = data.notes;

    if (Object.keys(updateData).length === 0) return false;

    // Try to update existing row in LISTING sheet
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sheets-proxy?action=update`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: sheetUrl,
          sheetName: LISTING_SHEET_NAME,
          updates: [{ plotNumber, data: updateData }],
        }),
      }
    );

    const result = await response.json();
    if (result.error) {
      console.error('Sheet update error:', result.error);
      return false;
    }

    console.log(`Sheet sync: updated ${result.updatedRows} rows, ${result.cellsUpdated} cells`);

    // If no rows were updated, the plot doesn't exist in LISTING sheet - append it
    if (result.updatedRows === 0) {
      return await appendListingToSheet(plotNumber, data);
    }

    return true;
  } catch (err) {
    console.error('Sheet sync error:', err);
    return false;
  }
}

export async function appendListingToSheet(plotNumber: string, data: {
  owner?: string;
  contact?: string;
  status?: string;
  price?: string;
  notes?: string;
  area?: string;
}): Promise<boolean> {
  const { sheetUrl } = getSheetConfig();
  if (!sheetUrl) return false;

  try {
    // Get LISTING sheet headers
    const lookupRes = await fetch(
      `${SUPABASE_URL}/functions/v1/sheets-proxy?action=lookup`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: sheetUrl,
          sheetName: LISTING_SHEET_NAME,
          plotNumbers: ['__dummy__'],
        }),
      }
    );

    const lookupData = await lookupRes.json();
    const headers: string[] = lookupData.headers || [];

    if (headers.length === 0) {
      console.error('Cannot append: no headers found in LISTING sheet');
      return false;
    }

    // Build a row matching the header order
    const headerLower = headers.map((h: string) => h.toString().trim().toLowerCase());
    const row: string[] = new Array(headers.length).fill('');

    // Map data to LISTING sheet columns
    const mappings: Record<string, string[]> = {
      'plotNumber': ['land number', 'plot number', 'plot', 'land', 'p-number'],
      'owner': ['owner', 'name', 'owner name', 'owner reference'],
      'contact': ['contact', 'mobile', 'phone', 'phone number', 'mobile number'],
      'status': ['status'],
      'price': ['price', 'asking price', 'amount'],
      'notes': ['notes', 'remarks', 'comment', 'actions'],
      'area': ['area (sqft)', 'land size', 'area', 'area sqm'],
    };

    const values: Record<string, string> = {
      plotNumber,
      owner: data.owner || '',
      contact: data.contact || '',
      status: data.status || 'Available',
      price: data.price || '',
      notes: data.notes || '',
      area: data.area || '',
    };

    for (const [field, possibleHeaders] of Object.entries(mappings)) {
      const val = values[field];
      if (!val) continue;
      for (const ph of possibleHeaders) {
        const idx = headerLower.indexOf(ph);
        if (idx !== -1) {
          row[idx] = val;
          break;
        }
      }
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sheets-proxy?action=append`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: sheetUrl,
          sheetName: LISTING_SHEET_NAME,
          rows: [row],
        }),
      }
    );

    const result = await response.json();
    if (result.error) {
      console.error('Sheet append error:', result.error);
      return false;
    }

    console.log(`Sheet append: added ${result.updatedRows} rows to LISTING sheet`);
    return true;
  } catch (err) {
    console.error('Sheet append error:', err);
    return false;
  }
}

export async function lookupOwnerFromSheet(plotNumber: string): Promise<{ owner: string; mobile: string } | null> {
  const { sheetUrl, dataSheetName } = getSheetConfig();
  if (!sheetUrl) return null;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sheets-proxy?action=lookup`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: sheetUrl,
          sheetName: dataSheetName || undefined,
          plotNumbers: [plotNumber],
        }),
      }
    );

    const data = await response.json();
    if (data.error) return null;

    const match = data.matches?.[plotNumber];
    if (!match) return null;

    const ownerKeys = ['owner', 'owner name', 'name', 'owner_reference', 'owner reference', 'owner ref'];
    const mobileKeys = ['mobile', 'phone', 'contact', 'phone number', 'contact number', 'mobile number'];

    let owner = '';
    let mobile = '';
    for (const key of ownerKeys) {
      if (match[key]) { owner = match[key]; break; }
    }
    for (const key of mobileKeys) {
      if (match[key]) { mobile = match[key]; break; }
    }

    return owner || mobile ? { owner, mobile } : null;
  } catch {
    return null;
  }
}

export async function bulkSyncListingsToSheet(listings: Array<{
  plotNumber: string;
  owner?: string;
  contact?: string;
  status?: string;
  price?: string;
  notes?: string;
  area?: string;
}>): Promise<{ synced: number; appended: number; errors: number }> {
  const { sheetUrl } = getSheetConfig();
  if (!sheetUrl) return { synced: 0, appended: 0, errors: 0 };

  let synced = 0, appended = 0, errors = 0;

  for (const listing of listings) {
    try {
      const result = await syncListingToSheet(listing.plotNumber, listing);
      if (result) synced++;
      else errors++;
    } catch {
      errors++;
    }
  }

  return { synced, appended, errors };
}

/**
 * Import all plots from the Google Sheet into the app.
 * Returns plot entries with owner/contact data.
 */
export async function importPlotsFromSheet(): Promise<Array<{
  plotNumber: string;
  owner: string;
  contact: string;
  area: string;
  rawData: Record<string, string>;
}>> {
  const { sheetUrl, dataSheetName } = getSheetConfig();
  if (!sheetUrl) return [];

  try {
    // Fetch ALL rows from the sheet via lookup with a special flag
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sheets-proxy?action=lookup`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: sheetUrl,
          sheetName: dataSheetName || undefined,
          plotNumbers: ['__all__'],
          returnAll: true,
        }),
      }
    );

    const data = await response.json();
    if (data.error) {
      console.error('Sheet import error:', data.error);
      return [];
    }

    const results: Array<{
      plotNumber: string;
      owner: string;
      contact: string;
      area: string;
      rawData: Record<string, string>;
    }> = [];

    // The matches object contains plot numbers as keys
    if (data.matches) {
      for (const [plotNum, rowData] of Object.entries(data.matches)) {
        const row = rowData as Record<string, string>;
        const ownerKeys = ['owner', 'owner name', 'name', 'owner_reference', 'owner reference'];
        const mobileKeys = ['mobile', 'phone', 'contact', 'phone number', 'contact number'];
        const areaKeys = ['land size', 'area (sqft)', 'area', 'area sqm'];

        let owner = '';
        let contact = '';
        let area = '';
        for (const key of ownerKeys) { if (row[key]) { owner = row[key]; break; } }
        for (const key of mobileKeys) { if (row[key]) { contact = row[key]; break; } }
        for (const key of areaKeys) { if (row[key]) { area = row[key]; break; } }

        // Only include entries with valid numeric plot numbers (DDA format: 5-10 digits)
        const isValidPlotNum = /^\d{5,10}$/.test(plotNum.trim());
        if (plotNum && plotNum !== '__all__' && isValidPlotNum) {
          results.push({ plotNumber: plotNum.trim(), owner, contact, area, rawData: row });
        }
      }
    }

    return results;
  } catch (err) {
    console.error('Sheet import error:', err);
    return [];
  }
}
