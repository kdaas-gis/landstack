const GEOSERVER_Url = 'http://117.252.86.213:8080/geoserver/wfs';

async function queryLayer(
    layer: string,
    query: string,
    nameKey: string,
    codeKey: string
): Promise<any[]> {
    const cql = `strToLowerCase(${nameKey}) like '%${query.toLowerCase()}%' OR ${codeKey} like '%${query}%'`;

    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        typeName: layer,
        outputFormat: 'application/json',
        CQL_FILTER: cql,
        maxFeatures: '5'
    });

    const url = `${GEOSERVER_Url}?${params.toString()}`;
    console.log(`Querying ${layer}... URL: ${url}`);

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Failed: ${res.statusText}`);
            console.error(await res.text());
            return [];
        }
        const text = await res.text();
        try {
            const data = JSON.parse(text);
            return data.features || [];
        } catch (e) {
            console.error(`JSON Parse Error for ${layer}:`, text.substring(0, 500));
            return [];
        }
    } catch (e) {
        console.error(`Error querying ${layer}:`, e);
        return [];
    }
}

async function search(query: string) {
    const promises = [
        queryLayer('application:District_Dissolved', query, 'kgisdist_n', 'kgisdistri'),
        queryLayer('application:Taluk_Dissolved', query, 'kgistalukn', 'lgd_talukc'),
        queryLayer('application:hobli_boundary', query, 'kgishoblin', 'kgishoblic'),
        queryLayer('application:hobli_boundary_dissolved', query, 'kgishoblin', 'kgishoblic'),
        queryLayer('application:village_boundary_dissolved', query, 'lgd_vill_n', 'lgd_vill_c')
    ];

    const results = await Promise.all(promises);
    const flatResults = results.flat();
    console.log(`\nFound ${flatResults.length} results for "${query}":`);
    flatResults.forEach(f => {
        console.log(`- ID: ${f.id}, Properties:`, JSON.stringify(f.properties));
    });
}

search('ANJANAPURA');
