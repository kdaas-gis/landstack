export type SearchResult = {
    id: string;
    label: string;
    type: 'District' | 'Taluk' | 'Hobli' | 'Village';
    bbox?: [number, number, number, number];
    geometry?: any;
    properties?: any;
    sourceLayer?: string;
    description?: string;
};

const GEOSERVER_Url = 'http://117.252.86.213:8080/geoserver/application/wfs';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

function getPropertyCaseInsensitive(properties: any, key: string): any[] {
    if (!properties) return [];
    const lowerKey = key.toLowerCase();
    const matches = [];
    for (const k in properties) {
        if (k.toLowerCase() === lowerKey) matches.push(properties[k]);
    }
    return matches;
}

async function queryLayer(
    layer: string,
    type: SearchResult['type'],
    query: string,
    nameKey: string,
    codeKey: string
): Promise<SearchResult[]> {
    // CQL Filter for case-insensitive partial match using ilike (GeoServer specific, but robust)
    // We cast the code component to string to safely handle integer columns like lgd_vill_c
    // Check if query is numeric (to decide if we should search the integer code column)
    const isNumeric = /^\d+$/.test(query.trim());

    let cql;
    if (isNumeric) {
        // Search both Name and Code if the query is a number
        // Note: 'like' on an integer column works in GeoServer if the passed value is numeric-like, 
        // but 'ilike' (upper case) fails.
        cql = `${nameKey} ilike '%${query}%' OR ${codeKey} like '%${query}%'`;
    } else {
        // If query has text, DO NOT search the integer code column to avoid type errors
        cql = `${nameKey} ilike '%${query}%'`;
    }

    console.log(`[Search] Querying layer: ${layer} with CQL: ${cql}`);

    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        typeName: layer,
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
        CQL_FILTER: cql,
        maxFeatures: '5'
    });

    const targetUrl = `${GEOSERVER_Url}?${params.toString()}`;
    const url = `${basePath}/api/proxy?url=${encodeURIComponent(targetUrl)}`;

    try {
        const res = await fetch(url);
        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('WFS Error (Raw Response):', text, e);
            return [];
        }

        if (!data.features) {
            console.warn('Search: No features found in response', data);
            return [];
        }

        try {
            const mappedResults = data.features.map((f: any) => {
                const props = f.properties || {};
                const names = getPropertyCaseInsensitive(props, nameKey);
                const name = names.length > 0 ? names[0] : null;
                // Also try to find the code if label is missing
                const label = name || f.id;

                // Construct description from hierarchy if available
                let description: string = type;
                if (type === 'Village') {
                    const hobli = props['kgishoblin'];
                    const taluk = props['lgd_tlk_n'];
                    const district = props['lgd_dst_n'];

                    const parts = [hobli, taluk, district].filter(Boolean);
                    if (parts.length > 0) {
                        description = parts.join(' - ').toString();
                    }
                }

                return {
                    id: f.id,
                    label: String(label),
                    type,
                    description,
                    bbox: f.bbox,
                    geometry: f.geometry,
                    properties: props,
                    sourceLayer: layer
                };
            });
            return mappedResults;
        } catch (mapError) {
            console.error('Search: Mapping error', mapError);
            return [];
        }
    } catch (e) {
        console.error(`Search failed for ${type}`, e);
        return [];
    }
}

/**
 * Parses coordinates in Decimal Degrees (DD) or Degrees, Minutes, Seconds (DMS) format.
 * Returns [longitude, latitude] if successful.
 */
function parseCoords(query: string): [number, number] | null {
    const q = query.trim();
    if (!q) return null;

    // 1. Try Decimal Degrees (DD)
    // Matches: "12.97, 77.59", "12.97 77.59", "+12.97, -77.59"
    const ddRegex = /^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/;
    const ddMatch = ddRegex.exec(q);
    if (ddMatch) {
        const lat = Number.parseFloat(ddMatch[1]);
        const lon = Number.parseFloat(ddMatch[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            return [lon, lat];
        }
    }

    // 2. Try Degrees, Minutes, Seconds (DMS)
    // Matches: 12° 58' 17" N, 77° 35' 40" E
    // Also matches variations without symbols: 12 58 17 N 77 35 40 E
    const dmsPart = /(\d+(?:\.\d+)?)[°\s:]+(\d+(?:\.\d+)?)['\s:]+(\d+(?:\.\d+)?)"?\s*([NSEW])/i;
    const dmsFullRegex = new RegExp(String.raw`^${dmsPart.source}[,\s]+${dmsPart.source}$`, 'i');
    const dmsMatch = dmsFullRegex.exec(q);

    if (dmsMatch) {
        const convert = (d: string, m: string, s: string, dir: string) => {
            let val = Number.parseFloat(d) + Number.parseFloat(m) / 60 + Number.parseFloat(s) / 3600;
            if (dir.toUpperCase() === 'S' || dir.toUpperCase() === 'W') val = -val;
            return val;
        };

        const lat = convert(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4]);
        const lon = convert(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8]);

        if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            return [lon, lat];
        }
    }

    return null;
}

export async function searchFeatures(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 3) return [];

    // Prioritize coordinate search
    const coords = parseCoords(query);
    if (coords) {
        return [{
            id: `coord-${coords[0]}-${coords[1]}`,
            label: `Go to coords: ${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`,
            type: 'Village', // Hack to make it compatible with existing UI if it filters by type
            geometry: {
                type: 'Point',
                coordinates: coords
            },
            properties: {
                name: 'Search Coordinate',
                latitude: coords[1],
                longitude: coords[0]
            }
        }];
    }

    // Search only for villages by name
    const results = await queryLayer(
        'application:village_boundary_dissolved',
        'Village',
        query,
        'lgd_vill_n',
        'lgd_vill_c'
    );

    // Return all results without deduplication as requested
    return results;


}

// ============ Advanced Search (Cascading Dropdowns) ============

type LocationOption = {
    code: string;
    name: string;
};

async function fetchDistinctValues(
    layer: string,
    cqlFilter: string | null,
    nameKey: string,
    codeKey: string,
    profile?: string
): Promise<LocationOption[]> {
    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        typeName: layer,
        outputFormat: 'application/json',
        propertyName: `${nameKey},${codeKey}`
    });

    if (cqlFilter) {
        params.set('CQL_FILTER', cqlFilter);
    }

    console.log(`[Advanced Search] Fetching distinct values for layer: ${layer}, filter: ${cqlFilter || 'None'}, property: ${nameKey},${codeKey}`);

    let url = `${basePath}/api/proxy?`;
    if (profile) {
        // If profile is present, DO NOT pass 'url'. The proxy will use the profile's URL.
        // We pass WFS params as query params to the proxy.
        params.append('profile', profile);
        url += params.toString();
    } else {
        // If no profile, use the default GEOSERVER_Url and pass it as 'url' param.
        // We can either bundle params into 'url' or pass them separately.
        // Passing them separately is cleaner if the proxy handles it, but let's stick to the working pattern:
        // Bundle them into the 'url' param to be safe/consistent with previous behavior for default layers.
        const targetUrl = `${GEOSERVER_Url}?${params.toString()}`;
        url += `url=${encodeURIComponent(targetUrl)}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.features) return [];

        // Extract unique values
        const seen = new Set<string>();
        const options: LocationOption[] = [];

        for (const f of data.features) {
            const code = String(f.properties[codeKey] || '');
            const name = f.properties[nameKey] || '';
            if (code && !seen.has(code)) {
                seen.add(code);
                options.push({ code, name });
            }
        }

        // Sort alphabetically by name
        return options.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error('Failed to fetch distinct values', e);
        return [];
    }
}

export async function getDistricts(): Promise<LocationOption[]> {
    return fetchDistinctValues(
        'application:village_boundary_dissolved',
        null,
        'lgd_dst_n',
        'lgd_dst_c'
    );
}

export async function getTaluks(districtCode: string): Promise<LocationOption[]> {
    return fetchDistinctValues(
        'application:village_boundary_dissolved',
        `lgd_dst_c = '${districtCode}'`,
        'lgd_tlk_n',
        'lgd_tlk_c'
    );
}

export async function getHoblis(talukCode: string): Promise<LocationOption[]> {
    return fetchDistinctValues(
        'application:village_boundary_dissolved',
        `lgd_tlk_c = '${talukCode}'`,
        'kgishoblin',
        'kgishoblic'
    );
}

export async function getVillages(hobliCode: string): Promise<LocationOption[]> {
    return fetchDistinctValues(
        'application:village_boundary_dissolved',
        `kgishoblic = '${hobliCode}'`,
        'lgd_vill_n',
        'lgd_vill_c'
    );
}

// ============ Survey Number / Hissa Search ============

const TALUK_LAYER_CONFIG: Record<string, { layer: string; profile: string; cols: { survey: string; surnoc: string; hissa: string; village: string } }> = {
    'Anekal': { layer: 'BU_anekal_Sva:anekal_polygon', profile: 'bu_anekal', cols: { survey: 'survey_num', surnoc: 'surnoc', hissa: 'hissa_num', village: 'lgd_vill_c' } },
    'Bangalore East': { layer: 'BU_bengaluru_east_Sva:east_polygon', profile: 'bu_bengaluru_east', cols: { survey: 'survey_num', surnoc: 'surnoc', hissa: 'hissa_num', village: 'lgd_vill_c' } },
    'Bengaluru East': { layer: 'BU_bengaluru_east_Sva:east_polygon', profile: 'bu_bengaluru_east', cols: { survey: 'survey_num', surnoc: 'surnoc', hissa: 'hissa_num', village: 'lgd_vill_c' } },
    'Bangalore North': { layer: 'BU_bengaluru_north_Sva:north_polygon', profile: 'bu_bengaluru_north', cols: { survey: 'survey_num', surnoc: 'surnoc', hissa: 'hissa_num', village: 'lgd_vill_c' } },
    'Bengaluru North': { layer: 'BU_bengaluru_north_Sva:north_polygon', profile: 'bu_bengaluru_north', cols: { survey: 'survey_num', surnoc: 'surnoc', hissa: 'hissa_num', village: 'lgd_vill_c' } },
    'Bangalore South': { layer: 'BU_bengaluru_south_Sva:south_polygon', profile: 'bu_bengaluru_south', cols: { survey: 'survey_num', surnoc: 'surnoc', hissa: 'hissa_num', village: 'lgd_vill_c' } },
    'Bengaluru South': { layer: 'BU_bengaluru_south_Sva:south_polygon', profile: 'bu_bengaluru_south', cols: { survey: 'survey_num', surnoc: 'surnoc', hissa: 'hissa_num', village: 'lgd_vill_c' } },
    'Yelahanka': { layer: 'BU_yelahanka_Sva:yelahanka_polygon', profile: 'bu_yelahanka', cols: { survey: 'survey_num', surnoc: 'surnoc', hissa: 'hissa_num', village: 'lgd_vill_c' } },
};

function getLayerConfig(talukName: string): { layer: string; profile: string; cols: { survey: string; surnoc: string; hissa: string; village: string } } {
    // Normalize name
    const name = talukName.trim();
    // Try exact match
    if (TALUK_LAYER_CONFIG[name]) return TALUK_LAYER_CONFIG[name];

    // Try case-insensitive matching
    const lower = name.toLowerCase();
    for (const key in TALUK_LAYER_CONFIG) {
        if (key.toLowerCase() === lower) return TALUK_LAYER_CONFIG[key];
    }

    // Partial match heuristics
    if (lower.includes('anekal')) return TALUK_LAYER_CONFIG['Anekal'];
    if (lower.includes('east')) return TALUK_LAYER_CONFIG['Bengaluru East'];
    if (lower.includes('north')) return TALUK_LAYER_CONFIG['Bengaluru North'];
    if (lower.includes('south')) return TALUK_LAYER_CONFIG['Bengaluru South'];
    if (lower.includes('yelahanka')) return TALUK_LAYER_CONFIG['Yelahanka'];

    // Fallback? or Error? 
    // Return a default or the old one? 
    return { layer: 'application:banglore_urban', profile: '', cols: { survey: 'Surveynumb', surnoc: 'Surnoc', hissa: 'HissaNo', village: 'LGD_Villag' } };
}


export async function getSurveyNumbers(villageCode: string, talukName: string = ''): Promise<LocationOption[]> {
    const config = getLayerConfig(talukName);
    // Note: LGD_Villag might be LGD_Village or something else.
    // Given the previous failure "property: LGD_Villag", verify if that column exists?
    // User log said: filter: LGD_Villag = '...' 
    // And error said: cant fetch survey number
    // So filter might be OK, but select property might be wrong.

    // But wait, if filter was wrong, GeoServer would usually throw CQL error.
    // If select property is wrong, it might return features without that property or error.
    // Let's assume 'LGD_Villag' is correct for Village code column (based on 'application:banglore_urban').
    // BUT for 'BU_bengaluru_east_Sva', it might be different.
    // Checking InfoPanel, it has 'LGD_Villag': 'Village Code'. So it is likely correct.

    const filter = `${config.cols.village} = '${villageCode}'`;

    return fetchDistinctValues(
        config.layer,
        filter,
        config.cols.survey,
        config.cols.survey,
        config.profile
    );
}

export async function getSurnocs(villageCode: string, surveyNumber: string, talukName: string = ''): Promise<LocationOption[]> {
    const config = getLayerConfig(talukName);
    const filter = `${config.cols.village} = '${villageCode}' AND ${config.cols.survey} = '${surveyNumber}'`;

    return fetchDistinctValues(
        config.layer,
        filter,
        config.cols.surnoc,
        config.cols.surnoc,
        config.profile
    );
}

export async function getHissas(villageCode: string, surveyNumber: string, surnoc: string, talukName: string = ''): Promise<LocationOption[]> {
    const config = getLayerConfig(talukName);
    const filter = `${config.cols.village} = '${villageCode}' AND ${config.cols.survey} = '${surveyNumber}' AND ${config.cols.surnoc} = '${surnoc}'`;

    return fetchDistinctValues(
        config.layer,
        filter,
        config.cols.hissa,
        config.cols.hissa,
        config.profile
    );
}

export async function getFeatureByHissa(
    villageCode: string,
    surveyNumber: string,
    surnoc: string,
    hissaNo: string,
    talukName: string = ''
): Promise<SearchResult | null> {
    const config = getLayerConfig(talukName);

    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        typeName: config.layer,
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
        CQL_FILTER: `${config.cols.village} = '${villageCode}' AND ${config.cols.survey} = '${surveyNumber}' AND ${config.cols.surnoc} = '${surnoc}' AND ${config.cols.hissa} = '${hissaNo}'`,
        maxFeatures: '1'
    });

    // Add profile if exists
    // if (config.profile) {
    //      params.append('profile', config.profile);
    // }

    let url = `${basePath}/api/proxy?`;
    if (config.profile) {
        params.append('profile', config.profile);
        url += params.toString();
    } else {
        const targetUrl = `${GEOSERVER_Url}?${params.toString()}`;
        url += `url=${encodeURIComponent(targetUrl)}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.features || data.features.length === 0) return null;

        const f = data.features[0];
        const label = `Survey ${f.properties['Surveynumb'] || surveyNumber}/${f.properties['Surnoc'] || surnoc}/${f.properties['HissaNo'] || hissaNo}`;

        return {
            id: f.id,
            label: label,
            type: 'Village',
            bbox: f.bbox,
            geometry: f.geometry,
            properties: f.properties,
            sourceLayer: config.layer
        };
    } catch (e) {
        console.error('Failed to fetch hissa feature', e);
        return null;
    }
}

export async function getFeatureByVillage(villageCode: string): Promise<SearchResult | null> {
    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        typeName: 'application:village_boundary_dissolved',
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
        CQL_FILTER: `lgd_vill_c = '${villageCode}'`,
        maxFeatures: '1'
    });

    const targetUrl = `${GEOSERVER_Url}?${params.toString()}`;
    const url = `${basePath}/api/proxy?url=${encodeURIComponent(targetUrl)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.features || data.features.length === 0) return null;

        const f = data.features[0];
        return {
            id: f.id,
            label: f.properties['lgd_vill_n'] || f.id,
            type: 'Village',
            bbox: f.bbox,
            geometry: f.geometry,
            properties: f.properties,
            sourceLayer: 'application:village_boundary_dissolved'
        };
    } catch (e) {
        console.error('Failed to fetch village feature', e);
        return null;
    }
}
