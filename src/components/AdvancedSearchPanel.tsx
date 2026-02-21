'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, MapPin, Loader2 } from 'lucide-react';
import Select from 'react-select';
import { getDistricts, getTaluks, getHoblis, getVillages, getFeatureByVillage, getSurveyNumbers, getSurnocs, getHissas, getFeatureByHissa } from '@/lib/search';
import type { SearchResult } from '@/lib/search';
import { useLanguage } from '@/lib/i18n';

type OptionType = {
    value: string;
    label: string;
};

type AdvancedSearchPanelProps = {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onResultSelect: (result: SearchResult) => void;
};

// Custom styles for react-select to match theme tokens
const selectStyles = {
    control: (base: any, state: any) => ({
        ...base,
        backgroundColor: 'rgba(248, 250, 252, 0.2)', // bg-base/20
        borderColor: state.isFocused ? 'var(--color-accent)' : '#e2e8f0', // accent : edge
        borderRadius: '0.75rem',
        boxShadow: state.isFocused ? '0 0 0 2px color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'none',
        '&:hover': {
            borderColor: state.isFocused ? 'var(--color-accent)' : '#cbd5e1'
        },
        minHeight: '42px',
        transition: 'all 0.2s ease'
    }),
    menu: (base: any) => ({
        ...base,
        backgroundColor: '#ffffff', // bg-panel
        border: '1px solid #e2e8f0', // border-edge
        borderRadius: '1rem',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
        zIndex: 100
    }),
    menuPortal: (base: any) => ({
        ...base,
        zIndex: 9999
    }),
    menuList: (base: any) => ({
        ...base,
        maxHeight: '200px',
        padding: '4px',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': {
            display: 'none'
        }
    }),
    option: (base: any, state: any) => {
        let backgroundColor = 'transparent';
        let color = '#0f172a'; // text-ink

        if (state.isSelected) {
            backgroundColor = 'var(--color-accent)'; // bg-accent
            color = '#ffffff';
        } else if (state.isFocused) {
            backgroundColor = 'color-mix(in srgb, var(--color-accent) 10%, transparent)'; // bg-accent/10
        }

        return {
            ...base,
            backgroundColor,
            color,
            cursor: 'pointer',
            borderRadius: '0.5rem',
            margin: '2px 0',
            fontSize: '13px',
            fontWeight: '500',
            '&:active': {
                backgroundColor: 'color-mix(in srgb, var(--color-accent) 20%, transparent)'
            }
        };
    },
    singleValue: (base: any) => ({
        ...base,
        color: '#0f172a', // text-ink
        fontSize: '13px',
        fontWeight: '500'
    }),
    input: (base: any) => ({
        ...base,
        color: '#0f172a'
    }),
    placeholder: (base: any) => ({
        ...base,
        color: '#64748b', // text-muted
        fontSize: '13px'
    }),
    indicatorSeparator: (base: any) => ({
        ...base,
        backgroundColor: '#e2e8f0'
    }),
    dropdownIndicator: (base: any) => ({
        ...base,
        color: '#64748b',
        '&:hover': {
            color: '#0f172a'
        }
    }),
    clearIndicator: (base: any) => ({
        ...base,
        color: '#64748b',
        '&:hover': {
            color: '#0f172a'
        }
    }),
    noOptionsMessage: (base: any) => ({
        ...base,
        color: '#64748b'
    }),
    loadingMessage: (base: any) => ({
        ...base,
        color: '#64748b'
    })
};

export default function AdvancedSearchPanel({ isOpen, onClose, onResultSelect }: AdvancedSearchPanelProps) {
    const { t } = useLanguage();

    // Dropdown options
    const [districts, setDistricts] = useState<OptionType[]>([]);
    const [taluks, setTaluks] = useState<OptionType[]>([]);
    const [hoblis, setHoblis] = useState<OptionType[]>([]);
    const [villages, setVillages] = useState<OptionType[]>([]);

    // Selected values
    const [selectedDistrict, setSelectedDistrict] = useState<OptionType | null>(null);
    const [selectedTaluk, setSelectedTaluk] = useState<OptionType | null>(null);
    const [selectedHobli, setSelectedHobli] = useState<OptionType | null>(null);
    const [selectedVillage, setSelectedVillage] = useState<OptionType | null>(null);
    const [selectedSurveyNumber, setSelectedSurveyNumber] = useState<OptionType | null>(null);
    const [selectedSurnoc, setSelectedSurnoc] = useState<OptionType | null>(null);
    const [selectedHissa, setSelectedHissa] = useState<OptionType | null>(null);

    // Filter Options
    const [surveyNumbers, setSurveyNumbers] = useState<OptionType[]>([]);
    const [surnocs, setSurnocs] = useState<OptionType[]>([]);
    const [hissas, setHissas] = useState<OptionType[]>([]);

    // Loading states
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [loadingTaluks, setLoadingTaluks] = useState(false);
    const [loadingHoblis, setLoadingHoblis] = useState(false);
    const [loadingVillages, setLoadingVillages] = useState(false);
    const [loadingSurveyNumbers, setLoadingSurveyNumbers] = useState(false);
    const [loadingSurnocs, setLoadingSurnocs] = useState(false);
    const [loadingHissas, setLoadingHissas] = useState(false);
    // Search mode
    const [searchMode, setSearchMode] = useState<'location' | 'dd' | 'dms'>('location');

    // Decimal Degrees state
    const [ddLat, setDdLat] = useState('');
    const [ddLon, setDdLon] = useState('');

    // DMS state
    const [dmsLatDeg, setDmsLatDeg] = useState('');
    const [dmsLatMin, setDmsLatMin] = useState('');
    const [dmsLatSec, setDmsLatSec] = useState('');
    const [dmsLatDir, setDmsLatDir] = useState<'N' | 'S'>('N');

    const [dmsLonDeg, setDmsLonDeg] = useState('');
    const [dmsLonMin, setDmsLonMin] = useState('');
    const [dmsLonSec, setDmsLonSec] = useState('');
    const [dmsLonDir, setDmsLonDir] = useState<'E' | 'W'>('E');

    const [searching, setSearching] = useState(false);

    // Load districts on mount
    useEffect(() => {
        if (isOpen && districts.length === 0) {
            setLoadingDistricts(true);
            getDistricts().then(data => {
                setDistricts(data.map(d => ({ value: d.code, label: d.name })));
                setLoadingDistricts(false);
            });
        }
    }, [isOpen, districts.length]);

    // Load taluks when district changes
    useEffect(() => {
        if (selectedDistrict) {
            setLoadingTaluks(true);
            setTaluks([]);
            setHoblis([]);
            setVillages([]);
            setSelectedTaluk(null);
            setSelectedHobli(null);
            setSelectedVillage(null);

            getTaluks(selectedDistrict.value).then(data => {
                setTaluks(data.map(d => ({ value: d.code, label: d.name })));
                setLoadingTaluks(false);
            });
        }
    }, [selectedDistrict]);

    // Load hoblis when taluk changes
    useEffect(() => {
        if (selectedTaluk) {
            setLoadingHoblis(true);
            setHoblis([]);
            setVillages([]);
            setSelectedHobli(null);
            setSelectedVillage(null);

            getHoblis(selectedTaluk.value).then(data => {
                setHoblis(data.map(d => ({ value: d.code, label: d.name })));
                setLoadingHoblis(false);
            });
        }
    }, [selectedTaluk]);

    // Load villages when hobli changes
    useEffect(() => {
        if (selectedHobli) {
            setLoadingVillages(true);
            setVillages([]);
            setSelectedVillage(null);
            setSurveyNumbers([]);
            setSelectedSurveyNumber(null);
            setSurnocs([]);
            setSelectedSurnoc(null);
            setHissas([]);
            setSelectedHissa(null);

            getVillages(selectedHobli.value).then(data => {
                setVillages(data.map(d => ({ value: d.code, label: d.name })));
                setLoadingVillages(false);
            });
        }
    }, [selectedHobli]);

    // Load Survey Numbers when Village changes
    useEffect(() => {
        if (selectedVillage) {
            setLoadingSurveyNumbers(true);
            setSurveyNumbers([]);
            setSelectedSurveyNumber(null);
            setSurnocs([]);
            setSelectedSurnoc(null);
            setHissas([]);
            setSelectedHissa(null);

            getSurveyNumbers(selectedVillage.value, selectedTaluk?.label || '').then(data => {
                setSurveyNumbers(data.map(d => ({ value: d.code, label: d.name })));
                setLoadingSurveyNumbers(false);
            });
        }
    }, [selectedVillage, selectedTaluk]);

    // Load Surnocs when Survey Number changes
    useEffect(() => {
        if (selectedVillage && selectedSurveyNumber) {
            setLoadingSurnocs(true);
            setSurnocs([]);
            setSelectedSurnoc(null);
            setHissas([]);
            setSelectedHissa(null);

            getSurnocs(selectedVillage.value, selectedSurveyNumber.value, selectedTaluk?.label || '').then(data => {
                setSurnocs(data.map(d => ({ value: d.code, label: d.name })));
                setLoadingSurnocs(false);
            });
        }
    }, [selectedSurveyNumber, selectedTaluk]);

    // Load Hissas when Surnoc changes
    useEffect(() => {
        if (selectedVillage && selectedSurveyNumber && selectedSurnoc) {
            setLoadingHissas(true);
            setHissas([]);
            setSelectedHissa(null);

            getHissas(selectedVillage.value, selectedSurveyNumber.value, selectedSurnoc.value, selectedTaluk?.label || '').then(data => {
                setHissas(data.map(d => ({ value: d.code, label: d.name })));
                setLoadingHissas(false);
            });
        }
    }, [selectedSurnoc, selectedTaluk]);

    const handleSearch = async () => {
        let feature: SearchResult | null = null;
        setSearching(true);

        if (searchMode === 'location') {
            if (!selectedVillage) {
                setSearching(false);
                return;
            }

            if (selectedSurveyNumber && selectedSurnoc && selectedHissa) {
                feature = await getFeatureByHissa(
                    selectedVillage.value,
                    selectedSurveyNumber.value,
                    selectedSurnoc.value,
                    selectedHissa.value,
                    selectedTaluk?.label || ''
                );
            } else {
                feature = await getFeatureByVillage(selectedVillage.value);
            }
        } else if (searchMode === 'dd') {
            const lat = Number.parseFloat(ddLat);
            const lon = Number.parseFloat(ddLon);

            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                feature = {
                    id: `dd-${lat}-${lon}`,
                    label: `Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
                    type: 'Village',
                    geometry: { type: 'Point', coordinates: [lon, lat] },
                    properties: { name: 'Custom Coordinates' }
                };
            }
        } else if (searchMode === 'dms') {
            const convert = (d: string, m: string, s: string, dir: string) => {
                let val = Number.parseFloat(d || '0') + Number.parseFloat(m || '0') / 60 + Number.parseFloat(s || '0') / 3600;
                if (dir === 'S' || dir === 'W') val = -val;
                return val;
            };

            const lat = convert(dmsLatDeg, dmsLatMin, dmsLatSec, dmsLatDir);
            const lon = convert(dmsLonDeg, dmsLonMin, dmsLonSec, dmsLonDir);

            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                feature = {
                    id: `dms-${lat}-${lon}`,
                    label: `Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
                    type: 'Village',
                    geometry: { type: 'Point', coordinates: [lon, lat] },
                    properties: { name: 'Custom Coordinates (DMS)' }
                };
            }
        }

        setSearching(false);

        if (feature) {
            onClose();
            setTimeout(() => {
                onResultSelect(feature!);
            }, 100);
        }
    };

    const handleReset = () => {
        setSelectedDistrict(null);
        setSelectedTaluk(null);
        setSelectedHobli(null);
        setSelectedVillage(null);
        setSelectedSurveyNumber(null);
        setSelectedSurnoc(null);
        setSelectedHissa(null);
        setTaluks([]);
        setHoblis([]);
        setVillages([]);
        setSurveyNumbers([]);
        setSurnocs([]);
        setHissas([]);
        setDdLat('');
        setDdLon('');
        setDmsLatDeg('');
        setDmsLatMin('');
        setDmsLatSec('');
        setDmsLonDeg('');
        setDmsLonMin('');
        setDmsLonSec('');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md mx-4 md:mx-4 bg-panel border border-edge rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-edge p-4 bg-base/50">
                            <div className="flex items-center gap-2">
                                <MapPin size={20} className="text-accent" />
                                <h2 className="text-sm font-bold text-ink leading-tight">
                                    {t('tool.parcelSearch')}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-base transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 md:p-6 overflow-y-auto flex-1">

                            {/* Mode Switcher */}
                            <div className="relative flex p-1 mb-6 bg-base/20 border border-edge rounded-xl">
                                {['location', 'dd', 'dms'].map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setSearchMode(mode as any)}
                                        className={`relative z-10 flex-1 px-2 py-1.5 text-xs font-bold transition-colors ${searchMode === mode ? 'text-ink' : 'text-muted'
                                            }`}
                                    >
                                        {t(`advancedSearch.mode.${mode}`)}
                                        {searchMode === mode && (
                                            <motion.div
                                                layoutId="mode-bg"
                                                className="absolute inset-0 z-[-1] bg-panel rounded-lg shadow-sm border border-edge"
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Search Forms */}
                            <div className="space-y-4 min-h-0">
                                {searchMode === 'location' && (
                                    <div className="space-y-4">
                                        {/* District */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                                                {t('layer.district')}
                                            </label>
                                            <Select
                                                value={selectedDistrict}
                                                onChange={(option) => setSelectedDistrict(option)}
                                                options={districts}
                                                isLoading={loadingDistricts}
                                                isSearchable
                                                isClearable
                                                placeholder={t('search.placeholder.district')}
                                                styles={selectStyles}
                                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                menuPosition="fixed"
                                            />
                                        </div>

                                        {/* Taluk */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                                                {t('layer.taluk')}
                                            </label>
                                            <Select
                                                value={selectedTaluk}
                                                onChange={(option) => setSelectedTaluk(option)}
                                                options={taluks}
                                                isLoading={loadingTaluks}
                                                isDisabled={!selectedDistrict}
                                                isSearchable
                                                isClearable
                                                placeholder={t('search.placeholder.taluk')}
                                                styles={selectStyles}
                                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                menuPosition="fixed"
                                            />
                                        </div>

                                        {/* Hobli */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                                                {t('layer.hobli')}
                                            </label>
                                            <Select
                                                value={selectedHobli}
                                                onChange={(option) => setSelectedHobli(option)}
                                                options={hoblis}
                                                isLoading={loadingHoblis}
                                                isDisabled={!selectedTaluk}
                                                isSearchable
                                                isClearable
                                                placeholder={t('search.placeholder.hobli')}
                                                styles={selectStyles}
                                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                menuPosition="fixed"
                                            />
                                        </div>

                                        {/* Village */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                                                {t('layer.village')}
                                            </label>
                                            <Select
                                                value={selectedVillage}
                                                onChange={(option) => setSelectedVillage(option)}
                                                options={villages}
                                                isLoading={loadingVillages}
                                                isDisabled={!selectedHobli}
                                                isSearchable
                                                isClearable
                                                placeholder={t('search.placeholder.village')}
                                                styles={selectStyles}
                                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                menuPosition="fixed"
                                            />
                                        </div>

                                        {/* Survey Number / Surnoc / Hissa Group */}
                                        <div className="grid grid-cols-3 gap-2">
                                            {/* Survey Number */}
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                                                    {t('search.survey_no')}
                                                </label>
                                                <Select
                                                    value={selectedSurveyNumber}
                                                    onChange={(option) => setSelectedSurveyNumber(option)}
                                                    options={surveyNumbers}
                                                    isLoading={loadingSurveyNumbers}
                                                    isDisabled={!selectedVillage}
                                                    isSearchable
                                                    isClearable
                                                    placeholder={t('search.placeholder.num')}
                                                    styles={selectStyles}
                                                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                    menuPosition="fixed"
                                                />
                                            </div>

                                            {/* Surnoc */}
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                                                    {t('search.surnoc')}
                                                </label>
                                                <Select
                                                    value={selectedSurnoc}
                                                    onChange={(option) => setSelectedSurnoc(option)}
                                                    options={surnocs}
                                                    isLoading={loadingSurnocs}
                                                    isDisabled={!selectedSurveyNumber}
                                                    isSearchable
                                                    isClearable
                                                    placeholder={t('search.placeholder.sur')}
                                                    styles={selectStyles}
                                                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                    menuPosition="fixed"
                                                />
                                            </div>

                                            {/* Hissa */}
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                                                    {t('search.hissa')}
                                                </label>
                                                <Select
                                                    value={selectedHissa}
                                                    onChange={(option) => setSelectedHissa(option)}
                                                    options={hissas}
                                                    isLoading={loadingHissas}
                                                    isDisabled={!selectedSurnoc}
                                                    isSearchable
                                                    isClearable
                                                    placeholder={t('search.placeholder.his')}
                                                    styles={selectStyles}
                                                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                    menuPosition="fixed"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {searchMode === 'dd' && (
                                    <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                                                    {t('coord.lat')}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={ddLat}
                                                    onChange={(e) => setDdLat(e.target.value)}
                                                    placeholder="e.g. 12.9716"
                                                    className="w-full bg-base/20 border border-edge rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                                                    {t('coord.lon')}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={ddLon}
                                                    onChange={(e) => setDdLon(e.target.value)}
                                                    placeholder="e.g. 77.5946"
                                                    className="w-full bg-base/20 border border-edge rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg">
                                            <p className="text-[12px] text-accent leading-relaxed italic">
                                                {t('coord.dd.description')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {searchMode === 'dms' && (
                                    <div className="space-y-8 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        {/* Latitude DMS */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-muted">
                                                    {t('coord.lat')}
                                                </label>
                                                <div className="flex bg-base/20 rounded-lg border border-edge p-0.5">
                                                    {['N', 'S'].map(dir => (
                                                        <button
                                                            key={dir}
                                                            onClick={() => setDmsLatDir(dir as any)}
                                                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${dmsLatDir === dir
                                                                ? 'bg-panel text-ink shadow-sm border border-edge'
                                                                : 'text-muted hover:text-ink hover:bg-base/20'
                                                                }`}
                                                        >
                                                            {t(`coord.${dir.toLowerCase()}`)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1 group">
                                                    <label className="absolute -top-2 left-2 px-1 bg-panel text-[9px] font-bold text-muted group-focus-within:text-accent transition-colors z-10">
                                                        {t('coord.degrees')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={dmsLatDeg}
                                                        onChange={(e) => setDmsLatDeg(e.target.value)}
                                                        placeholder="0"
                                                        className="w-full bg-base/20 border border-edge rounded-lg pl-3 pr-6 py-2.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted font-mono text-xs select-none">°</span>
                                                </div>
                                                <div className="relative flex-1 group">
                                                    <label className="absolute -top-2 left-2 px-1 bg-panel text-[9px] font-bold text-muted group-focus-within:text-accent transition-colors z-10">
                                                        {t('coord.minutes')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={dmsLatMin}
                                                        onChange={(e) => setDmsLatMin(e.target.value)}
                                                        placeholder="0"
                                                        className="w-full bg-base/20 border border-edge rounded-lg pl-3 pr-6 py-2.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted font-mono text-xs select-none">'</span>
                                                </div>
                                                <div className="relative flex-1 group">
                                                    <label className="absolute -top-2 left-2 px-1 bg-panel text-[9px] font-bold text-muted group-focus-within:text-accent transition-colors z-10">
                                                        {t('coord.seconds')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={dmsLatSec}
                                                        onChange={(e) => setDmsLatSec(e.target.value)}
                                                        placeholder="0"
                                                        className="w-full bg-base/20 border border-edge rounded-lg pl-3 pr-6 py-2.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted font-mono text-xs select-none">"</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Longitude DMS */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-muted">
                                                    {t('coord.lon')}
                                                </label>
                                                <div className="flex bg-base/20 rounded-lg border border-edge p-0.5">
                                                    {['E', 'W'].map(dir => (
                                                        <button
                                                            key={dir}
                                                            onClick={() => setDmsLonDir(dir as any)}
                                                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${dmsLonDir === dir
                                                                ? 'bg-panel text-ink shadow-sm border border-edge'
                                                                : 'text-muted hover:text-ink hover:bg-base/20'
                                                                }`}
                                                        >
                                                            {t(`coord.${dir.toLowerCase()}`)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1 group">
                                                    <label className="absolute -top-2 left-2 px-1 bg-panel text-[9px] font-bold text-muted group-focus-within:text-accent transition-colors z-10">
                                                        {t('coord.degrees')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={dmsLonDeg}
                                                        onChange={(e) => setDmsLonDeg(e.target.value)}
                                                        placeholder="0"
                                                        className="w-full bg-base/20 border border-edge rounded-lg pl-3 pr-6 py-2.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted font-mono text-xs select-none">°</span>
                                                </div>
                                                <div className="relative flex-1 group">
                                                    <label className="absolute -top-2 left-2 px-1 bg-panel text-[9px] font-bold text-muted group-focus-within:text-accent transition-colors z-10">
                                                        {t('coord.minutes')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={dmsLonMin}
                                                        onChange={(e) => setDmsLonMin(e.target.value)}
                                                        placeholder="0"
                                                        className="w-full bg-base/20 border border-edge rounded-lg pl-3 pr-6 py-2.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted font-mono text-xs select-none">'</span>
                                                </div>
                                                <div className="relative flex-1 group">
                                                    <label className="absolute -top-2 left-2 px-1 bg-panel text-[9px] font-bold text-muted group-focus-within:text-accent transition-colors z-10">
                                                        {t('coord.seconds')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={dmsLonSec}
                                                        onChange={(e) => setDmsLonSec(e.target.value)}
                                                        placeholder="0"
                                                        className="w-full bg-base/20 border border-edge rounded-lg pl-3 pr-6 py-2.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted font-mono text-xs select-none">"</span>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg">
                                                <p className="text-[12px] text-accent leading-relaxed italic">
                                                    {t('coord.dms.description')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 md:gap-3 mt-4 md:mt-6 pb-1">
                                <button
                                    onClick={handleReset}
                                    className="flex-1 px-2.5 py-1.5 md:px-4 md:py-2.5 bg-muted/50 border border-edge rounded-lg md:rounded-xl text-ink text-xs md:text-base font-bold hover:bg-muted/70 transition-all active:scale-95"
                                >
                                    {t('advancedSearch.reset') || 'Reset'}
                                </button>
                                <button
                                    onClick={handleSearch}
                                    disabled={
                                        (searchMode === 'location' && !selectedVillage) ||
                                        (searchMode === 'dd' && (!ddLat || !ddLon)) ||
                                        (searchMode === 'dms' && (!dmsLatDeg || !dmsLonDeg)) ||
                                        searching
                                    }
                                    className="flex-1 px-2.5 py-1.5 md:px-4 md:py-2.5 bg-accent rounded-lg md:rounded-xl text-white text-xs md:text-base font-bold hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 md:gap-2 shadow-lg shadow-accent/20"
                                >
                                    {searching ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Search size={16} />
                                    )}
                                    {searchMode === 'location' ? t('advancedSearch.search') : t('advancedSearch.goToCoords') || 'Go to Coordinates'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
