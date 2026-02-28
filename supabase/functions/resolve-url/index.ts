import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { url } = await req.json();

        if (!url) {
            return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`Resolving URL: ${url}`);

        // Fetch the URL to get the redirect location
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const finalUrl = response.url;
        console.log(`Final resolved URL: ${finalUrl}`);

        // Attempt to extract lat/lng from URL format: /@25.1234,55.1234,
        // Attempt to extract lat/lng from URL format: /@25.1234,55.1234, or /place/25.1234,55.1234
        const atMatch = finalUrl.match(/@([-\d.]+),([-\d.]+)/);
        const placeMatch = finalUrl.match(/\/place\/([-\d.]+),([-\d.]+)/);
        const match = atMatch || placeMatch;

        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);

            return new Response(JSON.stringify({ lat, lng, finalUrl }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } else {
            // Sometimes it's in the query params like ?ll=25.1234,55.1234 or q=25.1234,55.1234
            const urlObj = new URL(finalUrl);
            const q = urlObj.searchParams.get('q') || urlObj.searchParams.get('ll');
            if (q) {
                const parts = q.split(',');
                if (parts.length === 2) {
                    return new Response(JSON.stringify({
                        lat: parseFloat(parts[0]),
                        lng: parseFloat(parts[1]),
                        finalUrl
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            return new Response(JSON.stringify({
                error: 'Could not extract coordinates from the resolved map link',
                finalUrl
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

    } catch (error: unknown) {
        console.error('Resolve URL Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
