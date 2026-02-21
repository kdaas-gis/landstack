'use client';

import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, X, GripVertical } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

type InfoPanelProps = {
    readonly attributes: Record<string, any> | null;
    readonly sourceLayer?: string;
    readonly id?: string;
    readonly onClose: () => void;
    readonly variant?: 'sidebar' | 'sheet';
};

export default function InfoPanel({ attributes, sourceLayer, id, onClose, variant = 'sidebar' }: InfoPanelProps) {
    const { t } = useLanguage();

    if (!attributes) return null;

    console.log('[InfoPanel] Received attributes:', attributes);

    // Filter out internal OpenLayers properties
    const entries = Object.entries(attributes).filter(
        ([key]) => !key.startsWith('_')
    );

    // List of common attribute names to search for (District, Taluk, Hobli, Village)
    // These are used for finding the primary feature name and for display in the table.
    const nameKeys = {
        'lgd_dst_n': 'District Name',
        'lgd_distri': 'District Code',
        'lgd_tlk_n': 'Taluk Name',
        'lgd_talukc': 'Taluk Code',
        'kgistalukc': 'Taluk Code',
        'kgishoblin': 'Hobli Name',
        'kgishoblic': 'Hobli Code',
        'lgd_vill_n': 'Village Name',
        'lgd_vill_c': 'Village Code',
        'Surnoc': 'Surnoc',
        'HissaNo': 'Hissa No',
        'kharab': 'Kharab',
        'Surveynumb': 'Survey No',
        'LGD_Villag': 'Village Code',
        'survey_num': 'Survey No',
        'surnoc': 'Surnoc',
        'hissa_num': 'Hissa No',
        'hobli_n': 'Hobli',
        'akb_in_acres': 'Akarband (acres)',
        'akb_in_guntas': 'Akarband (guntas)',
        'name_as_rtc': 'Name as per RTC',
        'area_asp_polygon': 'Area as per polygon',
    };

    // Map GeoServer layer names to friendly display names using i18n
    // We prioritize the translation key if it exists, otherwise fallback to parsing the layer name
    const layerName = sourceLayer ? sourceLayer.toLowerCase() : '';
    let displayLayerName: string | undefined;

    if (sourceLayer) {
        // Try to translate the full source layer string (e.g. 'application:district_boundary')
        // We added these keys to i18n
        const translated = t(sourceLayer);
        if (translated !== sourceLayer) {
            displayLayerName = translated;
        } else if (sourceLayer.includes(':')) {
            // Fallback: value not in i18n, parse it manually
            // Extract workspace prefix, e.g. "BU_bengaluru_east_Sva:east_polygon" → "BU_east_Sva"
            displayLayerName = sourceLayer.split(':')[0].replace(/bengaluru_/gi, '').toUpperCase();
        } else {
            displayLayerName = sourceLayer;
        }
    }
    let primaryNameKeys: string[] = [];
    if (layerName.includes('bengaluru_rural')) {
        primaryNameKeys = ['Surveynumb', 'surveynu_1'];
    } else if (layerName.includes('_polygon')) {
        primaryNameKeys = ['survey_num', 'surnoc', 'hissa_num', 'Surveynumb', 'Surnoc', 'HissaNo'];
    } else if (layerName.includes('village')) {
        primaryNameKeys = ['lgd_vill_n', 'village_name'];
    } else if (layerName.includes('hobli')) {
        primaryNameKeys = ['kgishoblin', 'hobli_name'];
    } else if (layerName.includes('taluk')) {
        primaryNameKeys = ['lgd_tlk_n', 'kgistalukn', 'taluk_name'];
    } else if (layerName.includes('district')) {
        primaryNameKeys = ['lgd_dst_n', 'kgisdist_n', 'district_n'];
    } else if (layerName.includes('banglore_urban')) {
        primaryNameKeys = ['Surveynumb', 'Surnoc', 'HissaNo'];
    }
    // Add all keys from nameKeys object as fallback for primary name
    primaryNameKeys = [...primaryNameKeys, ...Object.keys(nameKeys)];


    const toTitleCase = (str: string) => {
        return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    };

    const rawFeatureName = primaryNameKeys
        .map(key => attributes[key])
        .find(val => typeof val === 'string' && val.length > 0);

    const getAttributeValue = (keys: string[]): string | undefined => {
        for (const key of keys) {
            const value = attributes[key];
            if (value === null || value === undefined) continue;
            const text = String(value).trim();
            if (text.length > 0) return text;
        }
        return undefined;
    };

    let featureName = rawFeatureName ? toTitleCase(rawFeatureName) : undefined;
    if (layerName.includes('_polygon') || layerName.includes('banglore_urban') || layerName.includes('bengaluru_urban')) {
        const surveyNo = getAttributeValue(['Surveynumb', 'survey_num']) || '*';
        const surnoc = getAttributeValue(['Surnoc', 'surnoc']) || '*';
        const hissaNo = getAttributeValue(['HissaNo', 'hissa_num']) || '*';
        featureName = `${surveyNo}/${surnoc}/${hissaNo}`;
    }

    const isSheet = variant === 'sheet';
    const dragConstraints = useRef(typeof document !== 'undefined' ? document.body : null);

    return (
        <motion.div
            initial={isSheet ? { opacity: 0, y: 100 } : { opacity: 0, x: -100 }}
            animate={isSheet ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 }}
            exit={isSheet ? { opacity: 0, y: 100 } : { opacity: 0, x: -100 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            drag={!isSheet}
            dragMomentum={false}
            dragConstraints={dragConstraints}
            dragElastic={0.05}
            style={!isSheet ? { zIndex: 50 } : undefined}
            className={`flex flex-col bg-panel border border-edge shadow-xl overflow-hidden ${isSheet
                ? 'rounded-t-2xl max-h-[50vh] border-b-0'
                : 'rounded-2xl max-h-[inherit]'
                }`}
        >
            {/* Drag handle for sheet */}
            {isSheet && (
                <div className="flex justify-center pt-2 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-edge" />
                </div>
            )}

            {/* Header — acts as drag handle on desktop */}
            <div className={`flex items-center justify-between border-b border-edge bg-base/50 shrink-0 ${isSheet ? 'px-4 py-3' : 'p-4'} ${!isSheet ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                {!isSheet && (
                    <GripVertical className="w-4 h-4 text-muted/50 shrink-0 mr-1" />
                )}
                <div className="flex-1 min-w-0 pr-4 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
                        {displayLayerName || t('info.featureDetails')}
                    </span>
                    {featureName && (
                        <h2 className="text-sm font-bold text-ink leading-tight truncate select-none">
                            {featureName}
                        </h2>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-base transition-colors"
                >
                    {isSheet ? <X className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="rounded-xl border border-edge bg-base/20 overflow-hidden shadow-inner">
                    <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                            <tr className="bg-base/80 border-b border-edge text-muted uppercase tracking-widest font-black">
                                <th className="px-3 py-2 w-1/3">{t('info.property')}</th>
                                <th className="px-3 py-2">{t('info.value')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge">
                            {/* {id && (
                                <tr className="hover:bg-panel transition-colors group">
                                    <td className="px-3 py-2.5 font-bold text-muted capitalize group-hover:text-ink">{t('info.uniqueId')}</td>
                                    <td className="px-3 py-2.5 font-mono text-ink font-medium break-all selection:bg-accent/20">
                                        {id}
                                    </td>
                                </tr>
                            )} */}
                            {entries.map(([key, value]) => {
                                // Only show requested names: Village, Hobli, Taluk, District
                                /* const whitelist = [
                                    'lgd_vill_n', 'lgd_vill_c',                 // Village
                                    'kgishoblin', 'kgishoblic',                 // Hobli
                                    'kgistalukn', 'lgd_tlk_n', 'lgd_talukc',    // Taluk
                                    'lgd_dst_n', 'kgisdist_n', 'kgisdistri'     // District
                                ];
                                if (!whitelist.includes(key)) {
                                    // console.log(`[InfoPanel] Skipping key: ${key} (not in whitelist)`);
                                    return null;
                                } */

                                // Blacklist internal/technical fields
                                const blacklist = ['geometry', 'bbox', 'the_geom', 'geom', 'shape_length', 'shape_area', 'objectid', 'lgd_distri', 'gid', 'surveynu_1',
                                    'fid', 'id', 'id_0', 'uniquevill', 'bhucode', 'censusvill', 'bhoomivill', 'lgdgpcode', 'lgdgpname', 'kgisstatec', 'lgd_tlk_c', 'lgd_dst_c', 'bhucodedis', 'area', 'sq.km', 'uni', 'lot', 'sqkm',
                                    'project_name', 'surveyor_name', 'property_number', 'phone_number', 'feature_type',
                                    'KGISCadast', 'UniqueVill', 'created_da', 'created_us', 'last_edi_1', 'last_edite', 'surveynu_1', 'KGISVill_1', 'KGISVillag', 'Label', 'SHAPE_Leng', 'SHAPE_Area',
                                ];
                                if (blacklist.includes(key.toLowerCase())) return null;

                                const translationKey = `attr.${key}`;
                                const translated = t(translationKey);
                                const displayName = translated !== translationKey ? translated : (nameKeys as Record<string, string>)[key] || key.replace(/_/g, ' ');

                                let displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

                                // Format date: "2026-02-18Z" -> "18 - February - 2026"
                                if (key === 'date' && typeof value === 'string') {
                                    const date = new Date(value);
                                    if (!isNaN(date.getTime())) {
                                        const day = date.getUTCDate().toString().padStart(2, '0');
                                        const month = date.toLocaleString('default', { month: 'short', timeZone: 'UTC' });
                                        const year = date.getUTCFullYear();
                                        displayValue = `${day}-${month}-${year}`;
                                    }
                                }

                                // Format time: "1970-01-01T00:14:20Z" -> "12:14 AM"
                                if (key === 'time' && typeof value === 'string') {
                                    const date = new Date(value);
                                    if (!isNaN(date.getTime())) {
                                        displayValue = date.toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true,
                                            timeZone: 'UTC'
                                        });
                                    }
                                }

                                if (primaryNameKeys.includes(key) && typeof value === 'string') { // Use primaryNameKeys for title casing
                                    displayValue = toTitleCase(value);
                                }

                                return (
                                    <tr key={key} className="hover:bg-panel transition-colors group">
                                        <td className="px-3 py-2.5 font-bold text-muted capitalize group-hover:text-ink">{displayName}</td>
                                        <td className="px-3 py-2.5 font-mono text-ink font-medium break-all selection:bg-accent/20">
                                            {displayValue}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Optional Action Button */}
                {/* <button className="w-full py-2.5 rounded-xl bg-accent text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
                    Export Feature Data
                </button> */}
            </div>

            {/* Footer / Context */}
            {/* <div className="p-3 border-t border-edge bg-base/50 text-center">
                <p className="text-[9px] font-bold text-muted uppercase tracking-[0.2em]">Source: Karnataka Geoserver</p>
            </div> */}
        </motion.div>
    );
}
