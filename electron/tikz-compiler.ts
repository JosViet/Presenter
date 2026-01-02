import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { app } from 'electron';

const CACHE_DIR = path.join(app.getPath('userData'), 'tikz_cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export function clearTikZCache(): boolean {
    try {
        if (fs.existsSync(CACHE_DIR)) {
            const files = fs.readdirSync(CACHE_DIR);
            for (const file of files) {
                fs.unlinkSync(path.join(CACHE_DIR, file));
            }
        }
        return true;
    } catch (e) {
        console.error('Failed to clear cache:', e);
        return false;
    }
}

export interface TikZCompileResult {
    success: boolean;
    svgPath?: string;
    error?: string;
    isCached: boolean;
}

export async function compileTikZ(code: string, texBinPath?: string, preamble: string = ''): Promise<TikZCompileResult> {
    // Include preamble in hash to ensure cache invalidation when macros change
    const hash = crypto.createHash('md5').update(code + preamble).digest('hex');
    const svgPath = path.join(CACHE_DIR, `${hash}.svg`);

    if (fs.existsSync(svgPath)) {
        return { success: true, svgPath, isCached: true };
    }

    const tempDir = path.join(app.getPath('temp'), `tikz_${hash}`);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const texFile = path.join(tempDir, 'temp.tex');
    const dviFile = path.join(tempDir, 'temp.dvi');

    // Standalone template with injected preamble
    const template = `
\\documentclass[tikz,border=2pt]{standalone}
\\usepackage[utf8]{vietnam}
\\usepackage{amsmath,amssymb}
\\usepackage{tkz-tab}
\\usepackage{tkz-euclide}
\\usepackage{pgfplots}
\\pgfplotsset{compat=newest}
\\usetikzlibrary{arrows,calc,intersections,shapes.geometric,patterns,positioning,angles,quotes,3d}
${preamble}
\\begin{document}
${code}
\\end{document}
    `.trim();

    fs.writeFileSync(texFile, template, 'utf-8');

    // Use proper path joining for the executable, handling the case where texBinPath might be empty or missing trailing slash
    const latexExe = texBinPath ? path.join(texBinPath, 'latex') : 'latex';
    const dvisvgmExe = texBinPath ? path.join(texBinPath, 'dvisvgm') : 'dvisvgm';

    // Quote the executables in case paths have spaces
    const latexCmd = `"${latexExe}" -interaction=nonstopmode -output-directory="${tempDir}" "${texFile}"`;
    const dvisvgmCmd = `"${dvisvgmExe}" --no-fonts "${dviFile}" -o "${svgPath}"`;

    // Log for debugging
    const logFile = path.join(app.getPath('userData'), 'tikz-debug.log');
    const log = (msg: string) => fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
    log(`Compiling: ${latexCmd}`);

    return new Promise((resolve) => {
        exec(latexCmd, (err, stdout, stderr) => {
            if (err) {
                const errorMsg = stderr || stdout || err.message;
                log(`LaTeX Error: ${errorMsg}`);
                console.error('LaTeX Error:', errorMsg);
                return resolve({ success: false, error: `LaTeX compilation failed: ${errorMsg}`, isCached: false });
            }

            exec(dvisvgmCmd, (err2, stdout2, stderr2) => {
                if (err2) {
                    const errorMsg = stderr2 || stdout2 || err2.message;
                    log(`dvisvgm Error: ${errorMsg}`);
                    console.error('dvisvgm Error:', errorMsg);
                    return resolve({ success: false, error: `SVG conversion failed: ${errorMsg}`, isCached: false });
                }

                // Cleanup temp files
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                } catch (e) {
                    console.warn('Temp cleanup failed:', e);
                }

                resolve({ success: true, svgPath, isCached: false });
            });
        });
    });
}
