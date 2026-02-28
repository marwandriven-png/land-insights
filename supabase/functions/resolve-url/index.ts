import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function dmsToDecimal(deg: number, min: number, sec: number, dir: string): number {
    const decimal = deg + min / 60 + sec / 3600;
    return (dir === 'S' || dir === 'W') ? -decimal : decimal;
}

function extractCoords(text: string): { lat: number; lng: number } | null {
    // /@25.1234,55.1234
    const atMatch = text.match(/@([-\d.]+),([-\d.]+)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

    // /place/25.1234,55.1234
    const placeMatch = text.match(/\/place\/([-\d.]+),([-\d.]+)/);
    if (placeMatch) return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };

    // ?q=25.1234,55.1234 or similar
    const qMatch = text.match(/[?&](?:q|ll|center)=([-\d.]+)(?:%2C|,)([-\d.]+)/);
    if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

    // !3d25.1234!4d55.1234
    const dataMatch = text.match(/!3d([-\d.]+)!4d([-\d.]+)/);
    if (dataMatch) return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };

    // DMS: 25°13'08.2"N 55°16'29.8"E (various quote styles)
    const dmsPattern = /(\d+)°(\d+)['''′](\d+(?:\.\d+)?)["""″]([NS])\s+(\d+)°(\d+)['''′](\d+(?:\.\d+)?)["""″]([EW])/;
    const dmsMatch = text.match(dmsPattern);
    if (dmsMatch) {
        return {
            lat: dmsToDecimal(parseInt(dmsMatch[1]), parseInt(dmsMatch[2]), parseFloat(dmsMatch[3]), dmsMatch[4]),
            lng: dmsToDecimal(parseInt(dmsMatch[5]), parseInt(dmsMatch[6]), parseFloat(dmsMatch[7]), dmsMatch[8]),
        };
    }

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

        // Quick check: can we extract coords from the URL itself?
        let coords = extractCoords(url);
        if (coords) {
            return new Response(JSON.stringify({ ...coords, finalUrl: url }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Single fast fetch with Googlebot UA (most likely to get redirect)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    // Try to mimic a mobile browser for better maps redirects or Googlebot
                    'User-Agent': 'Mozilla/5.0 (macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            clearTimeout(timeout);

            let finalUrl = response.url;
            const body = await response.text();
            console.log(`Resolved: status=${response.status}, url=${finalUrl.substring(0, 150)}, body=${body.length}`);

            // Handle Firebase Dynamic Links / JavaScript-based redirects which return 200 OK but contain <meta refresh> or window.location
            if (response.ok && (finalUrl.includes('maps.app.goo.gl') || finalUrl.includes('goo.gl'))) {
                const html = body;

                // Try meta refresh
                const metaRefreshMatch = html.match(/<meta[^>]*?content=["'][^"']*?url=([^"']+)["'][^>]*?>/i) ||
                    html.match(/<meta[^>]*?http-equiv=["']refresh["'][^>]*?content=["'][^"']*?url=([^"']+)["'][^>]*?>/i);

                // Try JS redirects
                const jsRedirectMatch = html.match(/window\.location\.replace\(['"]([^'"]+)['"]\)/) ||
                    html.match(/window\.location\.assign\(['"]([^'"]+)['"]\)/) ||
                    html.match(/window\.location\s*=\s*['"]([^'"]+)['"]/);

                // Try Firebase dynamic link intents
                const androidFallbackMatch = html.match(/<meta[^>]*?property=["']al:android:url["'][^>]*?content=["'](.*?)["'][^>]*?>/i);
                const iosFallbackMatch = html.match(/<meta[^>]*?property=["']al:ios:url["'][^>]*?content=["'](.*?)["'][^>]*?>/i);

                if (metaRefreshMatch && metaRefreshMatch[1]) {
                    finalUrl = metaRefreshMatch[1].replace(/&amp;/g, '&');
                } else if (jsRedirectMatch && jsRedirectMatch[1]) {
                    finalUrl = jsRedirectMatch[1];
                } else if (androidFallbackMatch && androidFallbackMatch[1]) {
                    finalUrl = androidFallbackMatch[1].replace(/&amp;/g, '&');
                } else if (iosFallbackMatch && iosFallbackMatch[1]) {
                    finalUrl = iosFallbackMatch[1].replace(/&amp;/g, '&');
                }

                // If it resolved to an intent URL with a fallback or deep link, try to parse it
                if (finalUrl.startsWith('intent://') || finalUrl.includes('intent:')) {
                    const linkMatch = finalUrl.match(/(?:link|fallback_url)=([^&]+)/);
                    if (linkMatch && linkMatch[1]) {
                        finalUrl = decodeURIComponent(linkMatch[1]);
                    }
                }
            }

            // Try final URL
            coords = extractCoords(finalUrl);
            if (coords) {
                console.log(`Coords from URL: ${coords.lat}, ${coords.lng}`);
                return new Response(JSON.stringify({ ...coords, finalUrl }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Try body (Google Maps full page has DMS in <h1> or coords in data)
            coords = extractCoords(body);
            if (coords) {
                console.log(`Coords from body: ${coords.lat}, ${coords.lng}`);
                return new Response(JSON.stringify({ ...coords, finalUrl }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        } catch (e) {
            clearTimeout(timeout);
            console.log(`Fetch failed: ${e}`);
        }

        // Short URL couldn't be resolved server-side
        return new Response(JSON.stringify({
            error: 'short_url',
            message: 'Short Google Maps URLs cannot be resolved directly. Please open the link in your browser, then copy the full URL from the address bar and paste it here.',
            finalUrl: url
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
