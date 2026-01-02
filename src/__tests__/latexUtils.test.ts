import { describe, it, expect } from 'vitest';
import { renderMath, parseSemantics } from '../utils/latexUtils';

// ============================================
// Test Cases for renderMath
// ============================================

describe('renderMath', () => {
    describe('Inline Math ($...$)', () => {
        it('should render simple inline math', () => {
            const result = renderMath('$x^2$');
            expect(result).toContain('katex');
            expect(result).toContain('x');
        });

        it('should handle multiple inline math expressions', () => {
            const result = renderMath('$a$ và $b$');
            expect(result).toContain('katex');
        });
    });

    describe('Display Math ($$...$$)', () => {
        it('should render display math with wrapper div', () => {
            const result = renderMath('$$x = \\frac{1}{2}$$');
            expect(result).toContain('<div class="my-4 overflow-x-auto">');
            expect(result).toContain('katex');
        });
    });

    describe('LaTeX Environment Conversions', () => {
        it('should convert align* to aligned', () => {
            const input = '\\begin{align*}x &= 1\\\\y &= 2\\end{align*}';
            const result = renderMath(input);
            expect(result).toContain('katex');
        });

        it('should convert eqnarray* to aligned', () => {
            const input = '\\begin{eqnarray*}x & = & 1\\end{eqnarray*}';
            const result = renderMath(input);
            expect(result).toContain('katex');
        });
    });

    describe('Text Processing', () => {
        it('should convert \\\\ to <br/>', () => {
            const result = renderMath('Line 1\\\\Line 2');
            expect(result).toContain('<br/>');
        });

        it('should convert \\newline to <br/>', () => {
            const result = renderMath('Line 1\\newline Line 2');
            expect(result).toContain('<br/>');
        });

        it('should convert \\begin{center} to div', () => {
            const result = renderMath('\\begin{center}text\\end{center}');
            expect(result).toContain('<div class="text-center">');
            expect(result).toContain('</div>');
        });

        it('should convert \\ldots to ...', () => {
            const result = renderMath('a, b, \\ldots, z');
            expect(result).toContain('...');
        });
    });

    describe('With Macros', () => {
        it('should apply custom macros', () => {
            const macros = { '\\R': '\\mathbb{R}' };
            const result = renderMath('$x \\in \\R$', macros);
            expect(result).toContain('katex');
        });
    });
});

// ============================================
// Test Cases for parseSemantics
// ============================================

describe('parseSemantics', () => {
    describe('Plain Text', () => {
        it('should return plain text as-is', () => {
            const result = parseSemantics('Hello World');
            expect(result).toHaveLength(1);
            expect(result[0]).toBe('Hello World');
        });
    });

    describe('\\immini Command', () => {
        it('should parse immini with content and image', () => {
            const input = '\\immini{Content here}{Image here}';
            const result = parseSemantics(input);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'immini',
                content: 'Content here',
                image: 'Image here'
            });
        });
    });

    describe('\\begin{multicols}', () => {
        it('should parse multicols with column count', () => {
            const input = '\\begin{multicols}{3}Column content\\end{multicols}';
            const result = parseSemantics(input);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'multicols',
                cols: 3,
                content: 'Column content'
            });
        });

        it('should default to 2 columns', () => {
            const input = '\\begin{multicols}{2}Two cols\\end{multicols}';
            const result = parseSemantics(input);
            expect((result[0] as any).cols).toBe(2);
        });
    });

    describe('\\begin{enumerate}', () => {
        it('should parse enumerate without options', () => {
            const input = '\\begin{enumerate}\\item A\\item B\\end{enumerate}';
            const result = parseSemantics(input);
            expect(result).toHaveLength(1);
            expect((result[0] as any).type).toBe('enumerate');
            expect((result[0] as any).opt).toBe('');
        });

        it('should parse enumerate with [a)] option', () => {
            const input = '\\begin{enumerate}[a)]\\item First\\end{enumerate}';
            const result = parseSemantics(input);
            expect((result[0] as any).opt).toBe('a)');
        });
    });

    describe('\\begin{itemize}', () => {
        it('should parse itemize', () => {
            const input = '\\begin{itemize}\\item Bullet 1\\item Bullet 2\\end{itemize}';
            const result = parseSemantics(input);
            expect(result).toHaveLength(1);
            expect((result[0] as any).type).toBe('itemize');
        });
    });

    describe('\\audio and \\video', () => {
        it('should parse audio command', () => {
            const input = '\\audio{sound.mp3}';
            const result = parseSemantics(input);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'audio',
                path: 'sound.mp3'
            });
        });

        it('should parse video command', () => {
            const input = '\\video{clip.mp4}';
            const result = parseSemantics(input);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'video',
                path: 'clip.mp4'
            });
        });
    });

    describe('Mixed Content', () => {
        it('should parse text before and after semantic parts', () => {
            const input = 'Before \\immini{A}{B} After';
            const result = parseSemantics(input);
            expect(result).toHaveLength(3);
            expect(result[0]).toBe('Before ');
            expect((result[1] as any).type).toBe('immini');
            expect(result[2]).toBe(' After');
        });
    });

    describe('Nested Environments', () => {
        it('should handle nested enumerate correctly', () => {
            const input = '\\begin{enumerate}\\item Outer\\begin{enumerate}\\item Inner\\end{enumerate}\\end{enumerate}';
            const result = parseSemantics(input);
            expect(result).toHaveLength(1);
            expect((result[0] as any).type).toBe('enumerate');
            // Content should include the nested enumerate
            expect((result[0] as any).content).toContain('\\begin{enumerate}');
        });
    });
});
