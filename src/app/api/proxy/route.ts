import { NextRequest, NextResponse } from 'next/server';

const CACHE = new Map<string, { data: ArrayBuffer; contentType: string | null; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 1000;

type ProxyProfile = {
    url: string;
    user: string;
    pass: string;
};

type AuthCandidate = {
    user: string;
    pass: string;
    source: 'profile' | 'bbmp' | 'default';
};

function normalizeEnvValue(value: string | undefined): string {
    if (!value) return '';
    let result = value.trim();
    // Strip surrounding quotes (Docker env_file keeps them as part of the value)
    if (
        (result.startsWith("'") && result.endsWith("'")) ||
        (result.startsWith('"') && result.endsWith('"'))
    ) {
        result = result.slice(1, -1).trim();
    }
    // Handle both \$ and $$ escaping for dollar signs
    result = result.replace(/\\\$/g, '$').replace(/\$\$/g, '$');
    return result;
}

function getProfile(profileId: string): ProxyProfile | null {
    const BU_ANEKAL_WFS_LINK = normalizeEnvValue(process.env.BU_ANEKAL_WFS_LINK);
    const BU_ANEKAL_USER = normalizeEnvValue(process.env.BU_ANEKAL_USER);
    const BU_ANEKAL_PASS = normalizeEnvValue(process.env.BU_ANEKAL_PASS);

    const BU_BENGALURU_EAST_WFS_LINK = normalizeEnvValue(process.env.BU_BENGALURU_EAST_WFS_LINK);
    const BU_BENGALURU_EAST_USER = normalizeEnvValue(process.env.BU_BENGALURU_EAST_USER);
    const BU_BENGALURU_EAST_PASS = normalizeEnvValue(process.env.BU_BENGALURU_EAST_PASS);

    const BU_BENGALURU_NORTH_WFS_LINK = normalizeEnvValue(process.env.BU_BENGALURU_NORTH_WFS_LINK);
    const BU_BENGALURU_NORTH_USER = normalizeEnvValue(process.env.BU_BENGALURU_NORTH_USER);
    const BU_BENGALURU_NORTH_PASS = normalizeEnvValue(process.env.BU_BENGALURU_NORTH_PASS);

    const BU_BENGALURU_SOUTH_WFS_LINK = normalizeEnvValue(process.env.BU_BENGALURU_SOUTH_WFS_LINK);
    const BU_BENGALURU_SOUTH_USER = normalizeEnvValue(process.env.BU_BENGALURU_SOUTH_USER);
    const BU_BENGALURU_SOUTH_PASS = normalizeEnvValue(process.env.BU_BENGALURU_SOUTH_PASS);

    const BU_YELAHANKA_WFS_LINK = normalizeEnvValue(process.env.BU_YELAHANKA_WFS_LINK);
    const BU_YELAHANKA_USER = normalizeEnvValue(process.env.BU_YELAHANKA_USER);
    const BU_YELAHANKA_PASS = normalizeEnvValue(process.env.BU_YELAHANKA_PASS);

    const profiles: Record<string, ProxyProfile | null> = {
        bu_anekal: BU_ANEKAL_WFS_LINK && BU_ANEKAL_USER && BU_ANEKAL_PASS
            ? {
                url: BU_ANEKAL_WFS_LINK,
                user: BU_ANEKAL_USER,
                pass: BU_ANEKAL_PASS,
            }
            : null,
        bu_bengaluru_east: BU_BENGALURU_EAST_WFS_LINK && BU_BENGALURU_EAST_USER && BU_BENGALURU_EAST_PASS
            ? {
                url: BU_BENGALURU_EAST_WFS_LINK,
                user: BU_BENGALURU_EAST_USER,
                pass: BU_BENGALURU_EAST_PASS,
            }
            : null,
        bu_bengaluru_north: BU_BENGALURU_NORTH_WFS_LINK && BU_BENGALURU_NORTH_USER && BU_BENGALURU_NORTH_PASS
            ? {
                url: BU_BENGALURU_NORTH_WFS_LINK,
                user: BU_BENGALURU_NORTH_USER,
                pass: BU_BENGALURU_NORTH_PASS,
            }
            : null,
        bu_bengaluru_south: BU_BENGALURU_SOUTH_WFS_LINK && BU_BENGALURU_SOUTH_USER && BU_BENGALURU_SOUTH_PASS
            ? {
                url: BU_BENGALURU_SOUTH_WFS_LINK,
                user: BU_BENGALURU_SOUTH_USER,
                pass: BU_BENGALURU_SOUTH_PASS,
            }
            : null,
        bu_yelahanka: BU_YELAHANKA_WFS_LINK && BU_YELAHANKA_USER && BU_YELAHANKA_PASS
            ? {
                url: BU_YELAHANKA_WFS_LINK,
                user: BU_YELAHANKA_USER,
                pass: BU_YELAHANKA_PASS,
            }
            : null,
    };

    return profiles[profileId] || null;
}

function cleanupCache() {
    if (CACHE.size > MAX_CACHE_SIZE) {
        const oldestKey = CACHE.keys().next().value;
        if (oldestKey) CACHE.delete(oldestKey); // Simple FIFO for cleanup
    }
}

async function fetchWithAuthCandidates(targetUrl: URL, candidates: AuthCandidate[]) {
    let lastResponse: Response | null = null;

    for (const candidate of candidates) {
        const credentials = `${candidate.user}:${candidate.pass}`;
        const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

        const response = await fetch(targetUrl, {
            headers: {
                'Authorization': authHeader,
            },
        });

        if (response.status !== 401 && response.status !== 404) {
            return { response, authSource: candidate.source };
        }

        lastResponse = response;
    }

    return { response: lastResponse, authSource: null as AuthCandidate['source'] | null };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const profileId = (searchParams.get('profile') || '').trim().toLowerCase();
    const profile = profileId ? getProfile(profileId) : null;
    const targetUrlBase = searchParams.get('url') || profile?.url || null;

    if (profileId && !profile) {
        return NextResponse.json({ error: `Unknown or misconfigured profile: ${profileId}` }, { status: 400 });
    }

    if (!targetUrlBase) {
        return NextResponse.json({ error: 'Missing target URL (or profile URL)' }, { status: 400 });
    }

    // Construct the full target URL by forwarding all search params except 'url'
    const targetUrl = new URL(targetUrlBase);
    searchParams.forEach((value, key) => {
        if (key !== 'url' && key !== 'profile') {
            targetUrl.searchParams.set(key, value);
        }
    });

    const cacheKey = `${profileId || 'default'}::${targetUrl.toString()}`;

    // Check cache
    const cached = CACHE.get(cacheKey);
    if (cached) {
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return new NextResponse(cached.data, {
                status: 200,
                headers: {
                    'Content-Type': cached.contentType || 'application/octet-stream',
                    'Cache-Control': 'public, max-age=86400, immutable',
                    'X-Proxy-Cache': 'HIT',
                },
            });
        } else {
            CACHE.delete(cacheKey);
        }
    }

    const bbmpUser = normalizeEnvValue(process.env.BBMP_USER);
    const bbmpPass = normalizeEnvValue(process.env.BBMP_PASS);
    const defaultUser = normalizeEnvValue(process.env.GEOSERVER_USER);
    const defaultPass = normalizeEnvValue(process.env.GEOSERVER_PASS);

    const candidates: AuthCandidate[] = [];
    if (profile?.user && profile?.pass) candidates.push({ user: profile.user, pass: profile.pass, source: 'profile' });
    if (bbmpUser && bbmpPass) candidates.push({ user: bbmpUser, pass: bbmpPass, source: 'bbmp' });
    if (defaultUser && defaultPass) candidates.push({ user: defaultUser, pass: defaultPass, source: 'default' });

    const dedupedCandidates = candidates.filter(
        (candidate, index, arr) =>
            arr.findIndex((c) => c.user === candidate.user && c.pass === candidate.pass) === index
    );

    if (dedupedCandidates.length === 0) {
        return NextResponse.json({ error: 'GeoServer credentials not configured' }, { status: 500 });
    }

    try {
        const { response, authSource } = await fetchWithAuthCandidates(targetUrl, dedupedCandidates);
        if (!response) {
            return NextResponse.json({ error: 'Failed to fetch from GeoServer' }, { status: 502 });
        }

        const contentType = response.headers.get('content-type');
        const data = await response.arrayBuffer();

        if (response.ok) {
            CACHE.set(cacheKey, {
                data,
                contentType,
                timestamp: Date.now(),
            });
            cleanupCache();
        }

        return new NextResponse(data, {
            status: response.status,
            headers: {
                'Content-Type': contentType || 'application/octet-stream',
                'Cache-Control': 'public, max-age=86400, immutable',
                'X-Proxy-Cache': 'MISS',
                'X-Proxy-Profile': profileId || 'default',
                'X-Proxy-Auth': authSource || 'none',
            },
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: 'Failed to fetch from GeoServer' }, { status: 502 });
    }
}
