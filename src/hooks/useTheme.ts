import { useState, useCallback } from 'react';
import { sounds } from '../utils/sound';

export type Theme = 'light' | 'sepia' | 'dark';

export const THEMES = {
    light: {
        bg: 'bg-white',
        text: 'text-gray-900',
        headerBg: 'bg-white',
        headerText: 'text-gray-800',
        optionBg: 'bg-white',
        optionBorder: 'border-gray-200',
        hoverOption: 'hover:bg-indigo-50 hover:border-indigo-300',
    },
    sepia: {
        bg: 'bg-[#f4ecd8]',
        text: 'text-[#433422]',
        headerBg: 'bg-[#eaddcf]',
        headerText: 'text-[#5c4b37]',
        optionBg: 'bg-[#fdf6e3]',
        optionBorder: 'border-[#d6c6b2]',
        hoverOption: 'hover:bg-[#efe4cd] hover:border-[#c5b5a0]',
    },
    dark: {
        bg: 'bg-gray-900',
        text: 'text-gray-100',
        headerBg: 'bg-gray-800',
        headerText: 'text-gray-200',
        optionBg: 'bg-gray-800',
        optionBorder: 'border-gray-700',
        hoverOption: 'hover:bg-gray-700 hover:border-gray-500',
    }
};

export function useTheme(initialTheme: Theme = 'light') {
    const [theme, setTheme] = useState<Theme>(initialTheme);

    const toggleTheme = useCallback(() => {
        sounds.playClick();
        setTheme(prev => {
            if (prev === 'light') return 'sepia';
            if (prev === 'sepia') return 'dark';
            return 'light';
        });
    }, []);

    const themeStyle = THEMES[theme];

    return {
        theme,
        setTheme,
        toggleTheme,
        themeStyle,
    };
}
