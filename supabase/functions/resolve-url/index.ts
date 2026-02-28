import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Try to extract coordinates from a URL string
function extractCoords(urlStr: string): { lat: number; lng: number } | null {
    // /@25.1234,55.1234
    const atMatch = urlStr.match(/@([-\d.]+),([-\d.]+)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

    // /place/25.1234,55.1234
    const placeMatch = urlStr.match(/\/place\/([-\d.]+),([-\d.]+)/);
    if (placeMatch) return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };

    // ?q=25.1234,55.1234 or ?ll=25.1234,55.1234
    try {
        const urlObj = new URL(urlStr);
        const q = urlObj.searchParams.get('q') || urlObj.searchParams.get('ll');
        if (q) {
            const parts = q.split(',');
            if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
                return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
            }
        }
    } catch { /* not a valid URL */ }

    // Direct coords format: 25.1234,55.1234 (just numbers)
    const directMatch = urlStr.match(/^([-\d.]+),([-\d.]+)$/);
    if (directMatch) return { lat: parseFloat(directMatch[1]), lng: parseFloat(directMatch[2]) };

    return null;
}

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

        // Check if input already contains coordinates directly
        const directCoords = extractCoords(url);
        if (directCoords) {
            console.log(`Direct coordinates found: ${directCoords.lat}, ${directCoords.lng}`);
            return new Response(JSON.stringify({ ...directCoords, finalUrl: url }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Strategy 1: Follow redirects manually to capture intermediate URLs
        let currentUrl = url;
        let coords: { lat: number; lng: number } | null = null;

        for (let i = 0; i < 5; i++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch(currentUrl, {
                    method: 'GET',
                    redirect: 'manual', // Don't auto-follow, inspect each hop
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                });
                clearTimeout(timeout);

                const location = response.headers.get('location');
                console.log(`Hop ${i}: ${response.status} → ${location?.substring(0, 200) || '(no redirect)'}`);

                if (location) {
                    coords = extractCoords(location);
                    if (coords) {
                        console.log(`Found coordinates at hop ${i}: ${coords.lat}, ${coords.lng}`);
                        return new Response(JSON.stringify({ ...coords, finalUrl: location }), {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }
                    currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
                } else {
                    // No more redirects, check final URL
                    coords = extractCoords(response.url || currentUrl);
                    if (coords) {
                        return new Response(JSON.stringify({ ...coords, finalUrl: response.url || currentUrl }), {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }

                    // Try reading response body for meta refresh or embedded coords
                    const body = await response.text();
                    const metaMatch = body.match(/content="[^"]*url=(https?:\/\/[^"]+)"/i);
                    if (metaMatch) {
                        coords = extractCoords(metaMatch[1]);
                        if (coords) {
                            return new Response(JSON.stringify({ ...coords, finalUrl: metaMatch[1] }), {
                                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                            });
                        }
                    }
                    break;
                }
            } catch (e) {
                clearTimeout(timeout);
                console.log(`Hop ${i} failed: ${e}`);
                break;
            }
        }

        // Strategy 2: Follow redirects automatically as fallback
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            clearTimeout(timeout);

            const finalUrl = response.url;
            console.log(`Final resolved URL: ${finalUrl}`);

            coords = extractCoords(finalUrl);
            if (coords) {
                return new Response(JSON.stringify({ ...coords, finalUrl }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        } catch (e) {
            console.log(`Follow redirect failed: ${e}`);
        }

        return new Response(JSON.stringify({
            error: 'Could not extract coordinates from the resolved map link. Try pasting a full Google Maps URL with coordinates visible, or enter coordinates directly (e.g. 25.2048,55.2708).',
            finalUrl: currentUrl
        }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: unknown) {
        console.error('Resolve URL Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
