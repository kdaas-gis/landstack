'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

type ToastProps = {
    readonly show: boolean;
    readonly onDismiss: () => void;
    readonly message: string;
    readonly type?: ToastType;
    readonly duration?: number;
};

export default function Toast({ show, onDismiss, message, type = 'info', duration = 3000 }: ToastProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (show) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                onDismiss();
            }, duration);
            return () => clearTimeout(timer);
        }
        setVisible(false);
    }, [show, onDismiss, duration]);

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />;
            case 'warning': return <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />;
            case 'error': return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
            default: return <Info className="h-4 w-4 text-accent shrink-0" />;
        }
    };

    const getStyles = () => {
        switch (type) {
            case 'success': return 'border-green-500/20 bg-green-950/90 shadow-green-900/20 text-green-200';
            case 'warning': return 'border-amber-500/20 bg-amber-950/90 shadow-amber-900/20 text-amber-200';
            case 'error': return 'border-red-500/20 bg-red-950/90 shadow-red-900/20 text-red-200';
            default: return 'border-accent/20 bg-accent/10 shadow-accent/20 text-white';
        }
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                    className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 rounded-xl border backdrop-blur-lg px-4 py-2.5 shadow-2xl ${getStyles()}`}
                >
                    {getIcon()}
                    <span className="text-sm font-medium text-center md:whitespace-nowrap max-w-[280px] md:max-w-none">
                        {message}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
