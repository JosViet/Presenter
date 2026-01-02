"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearTikZCache = clearTikZCache;
exports.compileTikZ = compileTikZ;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const electron_1 = require("electron");
const CACHE_DIR = path_1.default.join(electron_1.app.getPath('userData'), 'tikz_cache');
if (!fs_1.default.existsSync(CACHE_DIR)) {
    fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
}
function clearTikZCache() {
    try {
        if (fs_1.default.existsSync(CACHE_DIR)) {
            const files = fs_1.default.readdirSync(CACHE_DIR);
            for (const file of files) {
                fs_1.default.unlinkSync(path_1.default.join(CACHE_DIR, file));
            }
        }
        return true;
    }
    catch (e) {
        console.error('Failed to clear cache:', e);
        return false;
    }
}
async function compileTikZ(code, texBinPath, preamble = '') {
    // Include preamble in hash to ensure cache invalidation when macros change
    const hash = crypto_1.default.createHash('md5').update(code + preamble).digest('hex');
    const svgPath = path_1.default.join(CACHE_DIR, `${hash}.svg`);
    if (fs_1.default.existsSync(svgPath)) {
        return { success: true, svgPath, isCached: true };
    }
    const tempDir = path_1.default.join(electron_1.app.getPath('temp'), `tikz_${hash}`);
    if (!fs_1.default.existsSync(tempDir))
        fs_1.default.mkdirSync(tempDir);
    const texFile = path_1.default.join(tempDir, 'temp.tex');
    const dviFile = path_1.default.join(tempDir, 'temp.dvi');
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
    fs_1.default.writeFileSync(texFile, template, 'utf-8');
    // Use proper path joining for the executable, handling the case where texBinPath might be empty or missing trailing slash
    const latexExe = texBinPath ? path_1.default.join(texBinPath, 'latex') : 'latex';
    const dvisvgmExe = texBinPath ? path_1.default.join(texBinPath, 'dvisvgm') : 'dvisvgm';
    // Quote the executables in case paths have spaces
    const latexCmd = `"${latexExe}" -interaction=nonstopmode -output-directory="${tempDir}" "${texFile}"`;
    const dvisvgmCmd = `"${dvisvgmExe}" --no-fonts "${dviFile}" -o "${svgPath}"`;
    // Log for debugging
    const logFile = path_1.default.join(electron_1.app.getPath('userData'), 'tikz-debug.log');
    const log = (msg) => fs_1.default.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
    log(`Compiling: ${latexCmd}`);
    return new Promise((resolve) => {
        (0, child_process_1.exec)(latexCmd, (err, stdout, stderr) => {
            if (err) {
                const errorMsg = stderr || stdout || err.message;
                log(`LaTeX Error: ${errorMsg}`);
                console.error('LaTeX Error:', errorMsg);
                return resolve({ success: false, error: `LaTeX compilation failed: ${errorMsg}`, isCached: false });
            }
            (0, child_process_1.exec)(dvisvgmCmd, (err2, stdout2, stderr2) => {
                if (err2) {
                    const errorMsg = stderr2 || stdout2 || err2.message;
                    log(`dvisvgm Error: ${errorMsg}`);
                    console.error('dvisvgm Error:', errorMsg);
                    return resolve({ success: false, error: `SVG conversion failed: ${errorMsg}`, isCached: false });
                }
                // Cleanup temp files
                try {
                    fs_1.default.rmSync(tempDir, { recursive: true, force: true });
                }
                catch (e) {
                    console.warn('Temp cleanup failed:', e);
                }
                resolve({ success: true, svgPath, isCached: false });
            });
        });
    });
}
