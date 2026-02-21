import { getLength, getArea } from 'ol/sphere';
import { LineString, Polygon } from 'ol/geom';

// ── Unit Types ──────────────────────────────────────────

export type DistanceUnit = 'm' | 'km' | 'ft' | 'yd' | 'mi';
export type AreaUnit = 'sq.m' | 'ha' | 'ac' | 'sq.ft' | 'guntas';

export const DISTANCE_UNITS: { value: DistanceUnit; label: string }[] = [
    { value: 'm', label: 'Meters' },
    { value: 'km', label: 'Kilometers' },
    { value: 'ft', label: 'Feet' },
    { value: 'yd', label: 'Yards' },
    { value: 'mi', label: 'Miles' },
];

export const AREA_UNITS: { value: AreaUnit; label: string }[] = [
    { value: 'sq.m', label: 'Sq. Meters' },
    { value: 'ha', label: 'Hectares' },
    { value: 'ac', label: 'Acres' },
    { value: 'sq.ft', label: 'Sq. Feet' },
    { value: 'guntas', label: 'Guntas' },
];

// ── Distance Formatting ────────────────────────────────

export function formatDistance(meters: number, unit: DistanceUnit): string {
    switch (unit) {
        case 'km': return (meters / 1000).toFixed(2) + ' km';
        case 'ft': return (meters * 3.28084).toFixed(1) + ' ft';
        case 'yd': return (meters * 1.09361).toFixed(1) + ' yd';
        case 'mi': return (meters / 1609.344).toFixed(3) + ' mi';
        default: return meters.toFixed(1) + ' m';
    }
}

// ── Area Formatting ────────────────────────────────────

export function formatArea(m2: number, unit: AreaUnit): string {
    switch (unit) {
        case 'ha': return (m2 / 10_000).toFixed(3) + ' ha';
        case 'ac': return (m2 / 4046.856).toFixed(3) + ' ac';
        case 'sq.ft': return (m2 * 10.7639).toFixed(0) + ' sq.ft';
        case 'guntas': return (m2 / 101.17).toFixed(2) + ' guntas';
        default: return m2.toFixed(1) + ' sq.m';
    }
}

// ── Bearing Calculation ────────────────────────────────

/**
 * Calculate geodesic bearing from c1 to c2 (both in [lon, lat] degrees).
 * Returns bearing in degrees from north, 0–360.
 */
export function calculateBearing(c1: number[], c2: number[]): number {
    const toRad = Math.PI / 180;
    const lat1 = c1[1] * toRad;
    const lat2 = c2[1] * toRad;
    const dLon = (c2[0] - c1[0]) * toRad;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * (180 / Math.PI);
    return (brng + 360) % 360;
}

/**
 * Format bearing as quadrant notation: N 32° 15' E
 */
export function formatBearing(deg: number): string {
    // Normalize to 0-360
    deg = ((deg % 360) + 360) % 360;

    let prefix: string;
    let suffix: string;
    let angle: number;

    if (deg <= 90) {
        prefix = 'N'; suffix = 'E'; angle = deg;
    } else if (deg <= 180) {
        prefix = 'S'; suffix = 'E'; angle = 180 - deg;
    } else if (deg <= 270) {
        prefix = 'S'; suffix = 'W'; angle = deg - 180;
    } else {
        prefix = 'N'; suffix = 'W'; angle = 360 - deg;
    }

    const degrees = Math.floor(angle);
    const minutes = Math.floor((angle - degrees) * 60);

    if (minutes === 0) {
        return `${prefix} ${degrees}° ${suffix}`;
    }
    return `${prefix} ${degrees}° ${minutes}' ${suffix}`;
}

/**
 * Format bearing as compact string for segment labels: N32°E
 */
export function formatBearingCompact(deg: number): string {
    deg = ((deg % 360) + 360) % 360;

    let prefix: string;
    let suffix: string;
    let angle: number;

    if (deg <= 90) {
        prefix = 'N'; suffix = 'E'; angle = deg;
    } else if (deg <= 180) {
        prefix = 'S'; suffix = 'E'; angle = 180 - deg;
    } else if (deg <= 270) {
        prefix = 'S'; suffix = 'W'; angle = deg - 180;
    } else {
        prefix = 'N'; suffix = 'W'; angle = 360 - deg;
    }

    return `${prefix}${Math.round(angle)}°${suffix}`;
}

// ── Geometry Helpers ───────────────────────────────────

/** Calculate the geodesic length of a segment (two coords in EPSG:4326). */
export function segmentLength(c1: number[], c2: number[]): number {
    return getLength(new LineString([c1, c2]), { projection: 'EPSG:4326' });
}

/** Calculate the geodesic length of a full LineString geometry. */
export function lineLength(coords: number[][]): number {
    return getLength(new LineString(coords), { projection: 'EPSG:4326' });
}

/** Calculate the geodesic area of a polygon ring (coords in EPSG:4326). */
export function polygonArea(ring: number[][]): number {
    return getArea(new Polygon([ring]), { projection: 'EPSG:4326' });
}

/** Check if two coordinates are approximately equal. */
export function coordsEqual(c1: number[], c2: number[], tol = 1e-8): boolean {
    return Math.abs(c1[0] - c2[0]) < tol && Math.abs(c1[1] - c2[1]) < tol;
}

// ── Geometry Types ─────────────────────────────────────

export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'Rectangle';

export const GEOMETRY_TYPE_LABELS: Record<GeometryType, string> = {
    Point: 'Point',
    LineString: 'Line',
    Polygon: 'Polygon',
    Rectangle: 'Rectangle',
};
