'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, X, MapPin } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { searchFeatures, type SearchResult } from '@/lib/search';

type SearchBarProps = {
    readonly onResultSelect: (result: SearchResult) => void;
    readonly variant?: 'default' | 'spotlight';
    readonly placeholder?: string;
};

export default function SearchBar({ onResultSelect, variant = 'default', placeholder }: SearchBarProps) {
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const searchRef = useRef<HTMLDivElement>(null);

    const isSelectionRef = useRef(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (isSelectionRef.current) {
                isSelectionRef.current = false;
                return;
            }

            if (query.trim().length >= 3) {
                setLoading(true);
                try {
                    const data = await searchFeatures(query);
                    setResults(data);
                    setIsOpen(true);
                    setSelectedIndex(-1); // Reset selection
                } catch (error) {
                    console.error('Search error:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
                setIsOpen(false);
            }
        }, 300); // Reduced debounce for snappier feel

        return () => clearTimeout(timer);
    }, [query]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const inputRef = useRef<HTMLInputElement>(null);

    // Ctrl+K to focus
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSelect = (result: SearchResult) => {
        onResultSelect(result);
        setIsOpen(false);
        isSelectionRef.current = true;
        setQuery(result.label);
        setSelectedIndex(-1);
    };

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                inputRef.current?.blur();
                break;
        }
    };

    // Helper to highlight matching text
    const highlightMatch = (text: string, query: string) => {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) =>
            regex.test(part) ? <span key={i} className="text-accent font-extrabold">{part}</span> : part
        );
    };

    return (
        <div ref={searchRef} className={`relative group z-50 ${variant === 'spotlight' ? 'w-full max-w-xl mx-auto' : 'w-36 sm:w-48 md:w-96'}`}>
            <div className={`flex items-center bg-white/90 backdrop-blur-sm border border-edge rounded-xl px-4 shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent focus-within:shadow-md ${isOpen && results.length > 0 ? 'rounded-b-none border-b-0' : ''
                } ${variant === 'spotlight' ? 'py-4' : 'py-2.5'}`}>
                <Search className={`${variant === 'spotlight' ? 'w-5 h-5 md:w-6 md:h-6' : 'w-4 h-4'} text-muted/80 shrink-0`} />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || t('tool.search') || 'Search Villages...'}
                    className={`flex-1 bg-transparent border-none outline-none ml-3 text-ink placeholder:text-muted/60 w-full ${variant === 'spotlight' ? 'text-lg md:text-xl font-medium placeholder:text-muted/40' : 'text-sm'
                        }`}
                />
                {!loading && !query && variant !== 'spotlight' && (
                    <div className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded border border-edge bg-base/50 text-[10px] font-medium text-muted pointer-events-none select-none">
                        <span className="text-xs">⌘</span>K
                    </div>
                )}
                {loading && <Loader2 className={`text-accent animate-spin ml-2 ${variant === 'spotlight' ? 'w-5 h-5' : 'w-4 h-4'}`} />}
                {!loading && query && (
                    <button onClick={clearSearch} className="ml-2 hover:bg-base rounded-full p-1 text-muted hover:text-ink transition-colors" aria-label="Clear search">
                        <X className={`${variant === 'spotlight' ? 'w-5 h-5' : 'w-3.5 h-3.5'}`} />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isOpen && results.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.1 }}
                        className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md border-x border-b border-edge rounded-b-xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
                    >
                        <ul className="py-1">
                            {results.map((result, index) => (
                                <li key={result.id}>
                                    <button
                                        onClick={() => handleSelect(result)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 border-b border-edge/50 last:border-0 group ${index === selectedIndex ? 'bg-accent/5' : 'hover:bg-base/50'
                                            }`}
                                    >
                                        <div className={`mt-0.5 p-2 rounded-full transition-colors ${index === selectedIndex ? 'bg-accent/10 text-accent' : 'bg-base text-muted group-hover:text-ink'
                                            }`}>
                                            <MapPin className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold truncate ${index === selectedIndex ? 'text-accent' : 'text-ink'
                                                }`}>
                                                {highlightMatch(result.label, query)}
                                            </p>
                                            <p className="text-[11px] text-muted font-medium uppercase tracking-wider mt-0.5">
                                                {result.description || result.type}
                                            </p>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                )}
                {isOpen && !loading && query.length >= 3 && results.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md border border-edge rounded-xl shadow-xl p-6 text-center mt-2"
                    >
                        <p className="text-sm text-muted">No villages found for "<span className="font-semibold text-ink">{query}</span>"</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
