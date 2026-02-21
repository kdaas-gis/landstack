'use client';

import { motion } from 'motion/react';
import { useLanguage } from '@/lib/i18n';

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <div className="flex bg-panel border border-edge rounded-lg p-1 shadow-lg">
            <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${language === 'en'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-ink'
                    }`}
            >
                English
            </button>
            <button
                onClick={() => setLanguage('kn')}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${language === 'kn'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-ink'
                    }`}
            >
                ಕನ್ನಡ
            </button>
        </div>
    );
}
