

## Fix Google Sheet Owner Pull + UI Updates

### Problem Analysis

**Google Sheet not pulling owner data**: The `google-sheets-proxy` edge function code exists at `supabase/functions/google-sheets-proxy/index.ts` but has never been deployed. Every call from `QuickAddLandModal` to this function gets a 404 error, which is silently caught and results in "No Google Sheet match" being displayed -- even though the data (Maher Ahmad, 971556456700) exists in the sheet.

### Changes

**1. Deploy the google-sheets-proxy edge function**
- Deploy the existing edge function so it becomes available at the expected URL
- No code changes needed -- just deployment

**2. Change Offers icon from chat bubble to dollar sign**
- In `ListingsPage.tsx`, replace the `MessageCircle` icon on the offers button with `DollarSign`
- Also update the icon in the Offers dialog header

**3. Remove email field from Interested Buyers**
- In `ListingsPage.tsx`, remove the email `Input` field from the "Add Buyer" form
- Remove the `newBuyerEmail` state variable
- Remove email display from the buyer list items
- Remove `email` from the `InterestedBuyer` interface

**4. Make "Quick Add to Listing" button more badge-like**
- In `PlotListItem.tsx`, restyle the Quick Add button to look like a badge (rounded pill shape, small text label like "List", colored background) instead of a plain icon button

### Technical Details

Files to modify:
- `src/components/HyperPlot/ListingsPage.tsx` -- swap `MessageCircle` to `DollarSign`, remove email from buyer form/display
- `src/components/HyperPlot/PlotListItem.tsx` -- restyle Quick Add button as a badge
- Deploy `google-sheets-proxy` edge function (no code change, just deployment)

