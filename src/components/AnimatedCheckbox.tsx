'use client';

import { motion } from 'motion/react';

type AnimatedCheckboxProps = {
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
    readonly className?: string; // additional container classes
};

export default function AnimatedCheckbox({
    checked,
    onChange,
    className = ''
}: AnimatedCheckboxProps) {
    return (
        <div className={`relative flex items-center justify-center shrink-0 w-4 h-4 transition-transform duration-300 hover:scale-110 active:scale-95 ${className}`}>
            <input
                type="checkbox"
                className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 m-0"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <div
                className={`absolute inset-0 rounded border transition-all duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-accent ${checked ? 'bg-accent border-accent shadow-[0_0_10px_color-mix(in_srgb,var(--color-accent)_56%,transparent)]' : 'bg-black/40 border-edge'}`}
            />
            <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute z-10 w-3 h-3 pointer-events-none"
                initial={false}
                animate={checked ? 'checked' : 'unchecked'}
            >
                <motion.path
                    d="M4.5 12.5l4 4L19.5 6.5"
                    variants={{
                        checked: { pathLength: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 25, delay: 0.05 } },
                        unchecked: { pathLength: 0, opacity: 0, transition: { duration: 0.1 } }
                    }}
                />
            </motion.svg>
        </div>
    );
}
