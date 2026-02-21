'use client';

import { MapPin } from 'lucide-react';

type CoordinatesDisplayProps = {
    readonly coordinates: [number, number] | null; // [lon, lat]
};

// Get cardinal direction for latitude
function getLatDirection(decimal: number): string {
    return decimal >= 0 ? 'N' : 'S';
}

// Get cardinal direction for longitude
function getLonDirection(decimal: number): string {
    return decimal >= 0 ? 'E' : 'W';
}

// Convert decimal degrees to DMS (Degrees, Minutes, Seconds)
function decimalToDMS(decimal: number, isLatitude: boolean): string {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(2);
    const direction = isLatitude ? getLatDirection(decimal) : getLonDirection(decimal);
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

export default function CoordinatesDisplay({ coordinates }: CoordinatesDisplayProps) {
    if (!coordinates) {
        return (
            <div className="rounded-lg border border-edge bg-panel px-3 py-2 shadow-xl">
                <div className="flex items-center gap-2 text-muted">
                    <MapPin size={12} />
                    <span className="text-[10px] font-bold tracking-wide text-accent">
                        Enable Identify tool and click on map to see coordinates
                    </span>
                </div>
            </div>
        );
    }

    const [lon, lat] = coordinates;
    const latDMS = decimalToDMS(lat, true);
    const lonDMS = decimalToDMS(lon, false);

    return (
        <div className="rounded-lg border border-edge bg-panel px-3 py-2 shadow-xl">
            <div className="flex items-center gap-4">
                {/* Decimal Degrees */}
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-muted tracking-wider mb-0.5">Decimal Degrees</span>
                    <div className="flex gap-3 text-[11px] font-mono text-ink">
                        <span>{lat.toFixed(6)}°</span>
                        <span>{lon.toFixed(6)}°</span>
                    </div>
                </div>

                <div className="h-6 w-px bg-edge" />

                {/* DMS */}
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-muted tracking-wider mb-0.5">Degrees, Minutes, Seconds</span>
                    <div className="flex gap-2 text-[11px] font-mono text-ink">
                        <span>{latDMS}</span>
                        <span>{lonDMS}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
