import katex from 'katex';
import { extractBracedContent } from './latex-helpers-v2';

/**
 * Render LaTeX math content to HTML using KaTeX
 * Handles inline ($...$), display ($$...$$ and \[...\]), and text content
 */

const preprocessTextFormatting = (text: string): string => {
    // Commands to replace with HTML tags
    const TEXT_COMMANDS: Record<string, string> = {
        '\\textit': 'i',
        '\\textbf': 'b',
        '\\underline': 'u',
        '\\indam': 'b'
    };

    // Pre-process legacy formatting {\bf text} -> \textbf{text}
    text = text.replace(/\{\\bf\s+([^}]+)\}/g, "\\textbf{$1}");
    text = text.replace(/\{\\it\s+([^}]+)\}/g, "\\textit{$1}"); // NEW: Support {\it ...}

    let res = "";
    let i = 0;

    // Use a simple state machine to skip math blocks
    while (i < text.length) {
        // 1. SKIP MATH BLOCKS (preserve them for KaTeX)

        // Display Math $$...$$
        if (text.startsWith('$$', i)) {
            const end = text.indexOf('$$', i + 2);
            if (end !== -1) {
                res += text.substring(i, end + 2);
                i = end + 2;
                continue;
            }
        }

        // Display Math \[...\]
        if (text.startsWith('\\[', i)) {
            const end = text.indexOf('\\]', i + 2);
            if (end !== -1) {
                res += text.substring(i, end + 2);
                i = end + 2;
                continue;
            }
        }

        // Inline Math $...$
        if (text[i] === '$') {
            let end = i + 1;
            while (end < text.length) {
                // Determine if $ is escaped (preceded by odd number of backslashes)
                if (text[end] === '$') {
                    let backslashCount = 0;
                    let j = end - 1;
                    while (j >= i && text[j] === '\\') { backslashCount++; j--; }
                    if (backslashCount % 2 === 0) break; // Not escaped
                }
                end++;
            }
            if (end < text.length) {
                res += text.substring(i, end + 1);
                i = end + 1;
                continue;
            }
        }

        // 2. PROCESS TEXT COMMANDS
        let matchedCmd = null;
        for (const cmd in TEXT_COMMANDS) {
            if (text.startsWith(cmd, i)) {
                // Validate boundary (e.g. \textit vs \textitABC)
                const charAfter = text[i + cmd.length];
                if (!charAfter || !/[a-zA-Z]/.test(charAfter)) {
                    matchedCmd = cmd;
                    break;
                }
            }
        }

        if (matchedCmd) {
            // Check for brace
            let bracePos = i + matchedCmd.length;
            while (bracePos < text.length && /\s/.test(text[bracePos])) bracePos++;

            if (text[bracePos] === '{') {
                const extracted = extractBracedContent(text, bracePos);
                if (extracted) {
                    const tag = TEXT_COMMANDS[matchedCmd];
                    // RECURSIVE: Process content inside the braces
                    const innerProcessed = preprocessTextFormatting(extracted.content);
                    res += `<${tag}>${innerProcessed}</${tag}>`;
                    i = extracted.endIndex + 1;
                    continue;
                }
            }
        }

        // 3. DEFAULT
        res += text[i];
        i++;
    }
    return res;
};

// FontAwesome Macros
const FA_MACROS: Record<string, string> = {
    "\\faLeaf": "\\htmlClass{fas fa-leaf text-green-600}{}",
    "\\faLemonO": "\\htmlClass{far fa-lemon text-yellow-500}{}",
    "\\faPlane": "\\htmlClass{fas fa-plane text-blue-500}{}",
    "\\faShip": "\\htmlClass{fas fa-ship text-blue-700}{}",
    "\\faExclamationTriangle": "\\htmlClass{fas fa-exclamation-triangle text-amber-500}{}",
    "\\faCar": "\\htmlClass{fas fa-car text-red-500}{}",
    "\\faBus": "\\htmlClass{fas fa-bus text-yellow-600}{}",
    "\\faHome": "\\htmlClass{fas fa-home text-indigo-600}{}",
    "\\faInstitution": "\\htmlClass{fas fa-university text-gray-600}{}",
    "\\faStreetView": "\\htmlClass{fas fa-street-view text-teal-600}{}",
    "\\faCaretRight": "\\htmlClass{fas fa-caret-right text-gray-400}{}"
};

const replaceTextIcons = (text: string): string => {
    let clean = text;
    clean = clean.replace(/\\faLeaf/g, '<i class="fas fa-leaf text-green-600"></i>');
    clean = clean.replace(/\\faLemonO/g, '<i class="far fa-lemon text-yellow-500"></i>');
    clean = clean.replace(/\\faPlane/g, '<i class="fas fa-plane text-blue-500"></i>');
    clean = clean.replace(/\\faShip/g, '<i class="fas fa-ship text-blue-700"></i>');
    clean = clean.replace(/\\faExclamationTriangle/g, '<i class="fas fa-exclamation-triangle text-amber-500"></i>');
    clean = clean.replace(/\\faCar/g, '<i class="fas fa-car text-red-500"></i>');
    clean = clean.replace(/\\faBus/g, '<i class="fas fa-bus text-yellow-600"></i>');
    clean = clean.replace(/\\faHome/g, '<i class="fas fa-home text-indigo-600"></i>');
    clean = clean.replace(/\\faInstitution/g, '<i class="fas fa-university text-gray-600"></i>');
    clean = clean.replace(/\\faStreetView/g, '<i class="fas fa-street-view text-teal-600"></i>');
    clean = clean.replace(/\\faCaretRight/g, '<i class="fas fa-caret-right text-gray-400"></i>');
    return clean;
};

export const renderMath = (text: string, macros: Record<string, string> = {}): string => {
    if (!text) return '';

    // Combine default macros with user macros
    const combinedMacros = { ...FA_MACROS, ...macros };

    let processedText = text;

    // 0. Pre-process Text Formatting (OUTSIDE Math)
    processedText = preprocessTextFormatting(processedText);

    // 1. Fix line breaks and spacing
    processedText = processedText
        .replace(/\\,/g, '\\hspace{0.17em}')  // thin space (3/18 em)
        .replace(/\\;/g, '\\hspace{0.28em}')  // medium space (5/18 em)
        .replace(/\\!/g, '')                   // negative thin space
        .replace(/\\quad/g, '\\hspace{1em}')
        .replace(/\\quad/g, '\\hspace{1em}')
        .replace(/\\qquad/g, '\\hspace{2em}')
        .replace(/\\par/g, ''); // Ignore \par

    // Improved eqnarray conversion
    const fixEqnArray = (match: string) => {
        let content = match.replace(/\\begin\{eqnarray\*?\}/, '').replace(/\\end\{eqnarray\*?\}/, '');
        content = content.replace(/&\s*([=<>]|\\approx|\\leq|\\geq)\s*&/g, '& $1');
        return `$$\\begin{aligned}${content}\\end{aligned}$$`;
    };

    processedText = processedText.replace(/\\begin\{eqnarray\*?\}[\s\S]*?\\end\{eqnarray\*?\}/g, fixEqnArray);
    processedText = processedText.replace(/\\begin\{align\*?\}/g, '$$\\begin{aligned}');
    processedText = processedText.replace(/\\end\{align\*?\}/g, '\\end{aligned}$$');

    const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$(?:\\.|[^\$])+\$)/g;

    return processedText.split(regex).map((chunk) => {
        const isMath = chunk.startsWith('$') || chunk.startsWith('\\[');
        if (isMath) {
            const displayMode = chunk.startsWith('$$') || chunk.startsWith('\\[');
            const math = displayMode
                ? (chunk.startsWith('$$') ? chunk.slice(2, -2) : chunk.slice(2, -2)).trim()
                : chunk.slice(1, -1).trim();

            try {
                const html = katex.renderToString(math, {
                    displayMode,
                    throwOnError: false,
                    macros: combinedMacros,
                    trust: true, // Enable HTML in macros
                    strict: false
                });
                return displayMode ? `<div class="my-4 overflow-x-auto">${html}</div>` : html;
            } catch (e) { return chunk; }
        } else {
            let clean = chunk;
            clean = clean.replace(/\\\\/g, '<br/>');
            clean = clean.replace(/\\newline/g, '<br/>');
            clean = clean.replace(/\\hspace\{(.*?)\}/g, '<span style="display:inline-block; width:$1"></span>');

            clean = replaceTextIcons(clean);
            // replaceSafeFormatting removed (handled top-level)

            clean = clean.replace(/\\begin\{center\}/g, '<div class="text-center">');
            clean = clean.replace(/\\end\{center\}/g, '</div>');

            clean = clean.replace(/\\begin\{flushright\}/g, '<div class="text-right">');
            clean = clean.replace(/\\end\{flushright\}/g, '</div>');

            clean = clean.replace(/\\begin\{flushleft\}/g, '<div class="text-left">');
            clean = clean.replace(/\\end\{flushleft\}/g, '</div>');

            // Handle \setcounter{enumi}{N} for proper numbering
            clean = clean.replace(/\\setcounter\{enumi\}\{(\d+)\}/g, '<!--ENUMI_START:$1-->');

            const enumRegex = new RegExp('\\\\begin\\{enumerate\\}(?:\\s*\\[([\\s\\S]*?)\\])?', 'g');
            clean = clean.replace(enumRegex, (_match, optArg) => {
                if (optArg) {
                    const trimmed = optArg.trim();
                    if (trimmed === 'a)' || trimmed === 'A)' || trimmed === '1)' || trimmed === 'i)') {
                        return `<ol class="list-custom" style="list-style-type: ${trimmed.startsWith('a') ? 'lower-alpha' : trimmed.startsWith('A') ? 'upper-alpha' : trimmed.startsWith('i') ? 'lower-roman' : 'decimal'}">`;
                    }
                }
                return '<ol class="list-decimal ml-6 space-y-2">';
            });

            // Convert <!--ENUMI_START:N--> followed by <ol> to <ol start="N+1">
            clean = clean.replace(/<!--ENUMI_START:(\d+)-->\s*<ol([^>]*)>/g, (_m, num, attrs) => {
                const startNum = parseInt(num) + 1;
                return `<ol${attrs} start="${startNum}">`;
            });

            clean = clean.replace(/\\end\{enumerate\}/g, '</ol>');
            clean = clean.replace(/\\begin\{itemize\}/g, '<ul class="list-disc ml-6 space-y-2">');
            clean = clean.replace(/\\end\{itemize\}/g, '</ul>');
            clean = clean.replace(/\\item(\s*\[[^\]]*\])?/g, '<li>');
            clean = clean.replace(/\\ldots/g, '...');

            return clean;
        }
    }).join('');
};

/**
 * Parse LaTeX content into semantic parts (immini, multicols, enumerate, etc.)
 */
export interface SemanticPart {
    type: 'immini' | 'multicols' | 'enumerate' | 'itemize' | 'audio' | 'video';
    content?: string;
    image?: string;
    cols?: number;
    opt?: string;
    path?: string;
}

export const parseSemantics = (text: string): (string | SemanticPart)[] => {
    const parts: (string | SemanticPart)[] = [];
    let cursor = 0;

    // Helper to extract braced content
    const extractBraced = (start: number): { content: string; end: number } => {
        while (start < text.length && /\s/.test(text[start])) start++;
        if (text[start] !== '{') return { content: '', end: start };
        let d = 1, i = start + 1;
        while (i < text.length && d > 0) {
            if (text[i] === '\\' && (text[i + 1] === '{' || text[i + 1] === '}')) {
                i += 2; continue;
            }
            if (text[i] === '{') d++; else if (text[i] === '}') d--;
            i++;
        }
        return { content: text.substring(start + 1, i - 1), end: i };
    };

    // Helper to find matching end environment
    const findMatchingEnd = (startIdx: number, envName: string): number => {
        let d = 1;
        let searchCursor = startIdx;
        while (searchCursor < text.length && d > 0) {
            const open = text.indexOf(`\\begin{${envName}}`, searchCursor);
            const close = text.indexOf(`\\end{${envName}}`, searchCursor);
            if (close === -1) return -1;
            if (open !== -1 && open < close) {
                d++; searchCursor = open + 1;
            } else {
                d--;
                if (d === 0) return close;
                searchCursor = close + 1;
            }
        }
        return -1;
    };

    while (cursor < text.length) {
        const commands = [
            { cmd: 'immini', idx: text.indexOf('\\immini', cursor) },
            { cmd: 'multicols', idx: text.indexOf('\\begin{multicols}', cursor) },
            { cmd: 'enumerate', idx: text.indexOf('\\begin{enumerate}', cursor) },
            { cmd: 'itemize', idx: text.indexOf('\\begin{itemize}', cursor) },
            { cmd: 'audio', idx: text.indexOf('\\audio', cursor) },
            { cmd: 'video', idx: text.indexOf('\\video', cursor) }
        ].filter(x => x.idx !== -1).sort((a, b) => a.idx - b.idx);

        if (commands.length === 0) {
            parts.push(text.substring(cursor));
            break;
        }

        const next = commands[0];
        if (next.idx > cursor) {
            parts.push(text.substring(cursor, next.idx));
        }

        switch (next.cmd) {
            case 'immini': {
                let current = next.idx + 7;
                while (current < text.length && /\s/.test(text[current])) current++;
                if (text[current] === '[') {
                    let d = 1, i = current + 1;
                    while (i < text.length && d > 0) {
                        if (text[i] === '[') d++; else if (text[i] === ']') d--;
                        i++;
                    }
                    current = i;
                }
                const arg1 = extractBraced(current);
                const arg2 = extractBraced(arg1.end);
                parts.push({ type: 'immini', content: arg1.content, image: arg2.content });
                cursor = arg2.end;
                break;
            }
            case 'multicols': {
                const startContent = next.idx + '\\begin{multicols}'.length;
                const numColsArg = extractBraced(startContent);
                const endEnv = findMatchingEnd(numColsArg.end, 'multicols');
                if (endEnv !== -1) {
                    parts.push({ type: 'multicols', cols: parseInt(numColsArg.content) || 2, content: text.substring(numColsArg.end, endEnv) });
                    cursor = endEnv + '\\end{multicols}'.length;
                } else {
                    parts.push(text.substring(next.idx));
                    cursor = text.length;
                }
                break;
            }
            case 'enumerate': {
                let contentStart = next.idx + '\\begin{enumerate}'.length;
                let optArg = '';
                let current = contentStart;
                while (current < text.length && /\s/.test(text[current])) current++;
                if (text[current] === '[') {
                    let d = 1, i = current + 1;
                    while (i < text.length && d > 0) {
                        if (text[i] === '[') d++; else if (text[i] === ']') d--;
                        i++;
                    }
                    optArg = text.substring(current + 1, i - 1);
                    contentStart = i;
                }
                const endEnv = findMatchingEnd(contentStart, 'enumerate');
                if (endEnv !== -1) {
                    parts.push({ type: 'enumerate', opt: optArg, content: text.substring(contentStart, endEnv) });
                    cursor = endEnv + '\\end{enumerate}'.length;
                } else {
                    parts.push(text.substring(next.idx));
                    cursor = text.length;
                }
                break;
            }
            case 'itemize': {
                const contentStart = next.idx + '\\begin{itemize}'.length;
                const endEnv = findMatchingEnd(contentStart, 'itemize');
                if (endEnv !== -1) {
                    parts.push({ type: 'itemize', content: text.substring(contentStart, endEnv) });
                    cursor = endEnv + '\\end{itemize}'.length;
                } else {
                    parts.push(text.substring(next.idx));
                    cursor = text.length;
                }
                break;
            }
            case 'audio':
            case 'video': {
                const arg = extractBraced(next.idx + 6);
                parts.push({ type: next.cmd, path: arg.content });
                cursor = arg.end;
                break;
            }
        }
    }
    return parts;
};

export const cleanItemContent = (itemStr: string): string => {
    let str = itemStr.trim();
    if (str.startsWith('\\item')) {
        str = str.substring(5).trim();
    }

    if (str.startsWith('[')) {
        let depth = 1;
        let i = 1;
        while (i < str.length && depth > 0) {
            // Simple skip for escaped characters
            if (str[i] === '\\' && i + 1 < str.length) {
                i += 2;
                continue;
            }

            if (str[i] === '[') depth++;
            else if (str[i] === ']') depth--;
            i++;
        }

        // If balanced, strip the option
        if (depth === 0) {
            return str.substring(i).trim();
        }
    }

    return str;
};
