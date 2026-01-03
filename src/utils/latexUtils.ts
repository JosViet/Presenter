import katex from 'katex';

/**
 * Render LaTeX math content to HTML using KaTeX
 * Handles inline ($...$), display ($$...$$ and \[...\]), and text content
 */
export const renderMath = (text: string, macros: Record<string, string> = {}): string => {
    // Handle spacing commands
    let processedText = text
        .replace(/\\,/g, '\\hspace{0.17em}')  // thin space (3/18 em)
        .replace(/\\;/g, '\\hspace{0.28em}')  // medium space (5/18 em)
        .replace(/\\!/g, '')                   // negative thin space (remove for simplicity)
        .replace(/\\quad/g, '\\hspace{1em}')
        .replace(/\\qquad/g, '\\hspace{2em}');

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
        if (chunk.startsWith('$$') || chunk.startsWith('\\[')) {
            try {
                const math = (chunk.startsWith('$$') ? chunk.slice(2, -2) : chunk.slice(2, -2)).trim();
                return `<div class="my-4 overflow-x-auto">${katex.renderToString(math, { displayMode: true, throwOnError: false, macros })}</div>`;
            } catch (e) { return chunk; }
        } else if (chunk.startsWith('$')) {
            try {
                return katex.renderToString(chunk.slice(1, -1), { displayMode: false, throwOnError: false, macros });
            } catch (e) { return chunk; }
        } else {
            let clean = chunk;
            clean = clean.replace(/\\\\/g, '<br/>');
            clean = clean.replace(/\\newline/g, '<br/>');
            clean = clean.replace(/\\hspace\{(.*?)\}/g, '<span style="display:inline-block; width:$1"></span>');

            // FontAwesome Icons
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

            clean = clean.replace(/\\begin\{center\}/g, '<div class="text-center">');
            clean = clean.replace(/\\end\{center\}/g, '</div>');

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
            clean = clean.replace(/\\item/g, '<li>');
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
