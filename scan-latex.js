const fs = require('fs');
const path = require('path');

const SAMPLE_DATA_DIR = path.join(__dirname, 'sample-data');

// Known Supported Commands (from parser_presenter.ts + KaTeX common)
const IGNORED_COMMANDS = new Set([
    // Structure
    'documentclass', 'usepackage', 'begin', 'end', 'section', 'subsection', 'subsubsection',
    'item', 'centering', 'par', 'noindent', 'label', 'ref', 'cite', 'input', 'include',

    // Parser-handled (Custom)
    'heva', 'hoac', 'immini', 'loigiai', 'choice', 'choiceTF',
    'motcot', 'haicot', 'boncot', 'shortans', 'true', 'false',
    'indam', 'iconMT', 'dots',

    // Formatting
    'textbf', 'textit', 'underline', 'textsc', 'emph', 'text', 'mbox', 'mathrm',
    'bf', 'it', 'rm', 'sf', 'tt',
    'vspace', 'hspace', 'quad', 'qquad', 'hfill', 'vfill', 'newline', 'centering',
    'large', 'Large', 'huge', 'Huge', 'small', 'footnotesize', 'scriptsize', 'tiny',
    'color', 'textcolor', 'colorbox',

    // Math (KaTeX Common)
    'frac', 'dfrac', 'sqrt', 'cdot', 'times', 'div', 'pm', 'mp',
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
    'sum', 'prod', 'int', 'oint', 'lim', 'sup', 'inf', 'max', 'min',
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan',
    'ln', 'log', 'exp',
    'left', 'right', 'big', 'Big', 'bigg', 'Bigg',
    'vec', 'hat', 'bar', 'tilde', 'overline', 'underline',
    'mathbb', 'mathcal', 'mathscr', 'mathfrak', 'mathbf', 'mathit', 'mathsf', 'mathtt',
    'le', 'ge', 'leq', 'geq', 'neq', 'approx', 'equiv', 'cong', 'sim', 'simeq',
    'subset', 'subseteq', 'supset', 'supseteq', 'in', 'notin', 'cup', 'cap', 'setminus',
    'forall', 'exists', 'nexists', 'empty', 'emptyset',
    'to', 'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow', 'leftrightarrow', 'Leftrightarrow', 'mapsto',
    'infty', 'partial', 'nabla', 'triangle',
    'tag', 'not', 'mid', 'parallel', 'perp',
    'cases', 'array', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix',
    'aligned', 'gather', 'gathered', 'split',
    'limits', 'nolimits'
]);

// Allow searching for \begin{env}
const IGNORED_ENVS = new Set([
    'document', 'center', 'itemize', 'enumerate', 'description', 'multicols',
    'tabular', 'array', 'pmatrix', 'bmatrix', 'cases',
    'align', 'align*', 'equation', 'equation*', 'gather', 'gather*',
    'ex', 'bt', 'vd', 'dang', 'boxdn', 'note', 'nx', 'luuy', 'tomtat',
    'tikzpicture'
]);

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.endsWith('.tex')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

function analyzeFiles() {
    try {
        const filePaths = getAllFiles(SAMPLE_DATA_DIR);
        console.log(`Scanning ${filePaths.length} .tex files...`);

        const commandCounts = {};
        const envCounts = {};

        filePaths.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');

            // 1. Scan Commands: \cmdname
            // We ignore arguments for now, just count command frequency
            const cmdRegex = /\\([a-zA-Z@]+)/g;
            let match;
            while ((match = cmdRegex.exec(content)) !== null) {
                const cmd = match[1];
                if (!IGNORED_COMMANDS.has(cmd)) {
                    commandCounts[cmd] = (commandCounts[cmd] || 0) + 1;
                }
            }

            // 2. Scan Environments: \begin{envname}
            const envRegex = /\\begin\{([a-zA-Z0-9*]+)\}/g;
            while ((match = envRegex.exec(content)) !== null) {
                const env = match[1];
                if (!IGNORED_ENVS.has(env)) {
                    envCounts[env] = (envCounts[env] || 0) + 1;
                }
            }
        });

        // Sort and Print
        console.log('\n--- POTENTIAL UNHANDLED COMMANDS (Top 20) ---');
        const sortedCmds = Object.entries(commandCounts)
            .sort((a, b) => b[1] - a[1])
            .filter(([cmd, count]) => count > 5)
            .slice(0, 20); // TOP 20 ONLY

        sortedCmds.forEach(([cmd, count]) => {
            console.log(`\\${cmd}: ${count}`);
        });

        console.log('\n--- POTENTIAL UNHANDLED ENVIRONMENTS ---');
        const sortedEnvs = Object.entries(envCounts)
            .sort((a, b) => b[1] - a[1]);

        sortedEnvs.forEach(([env, count]) => {
            console.log(`\\begin{${env}}: ${count}`);
        });

    } catch (e) {
        console.error("Error scanning:", e);
    }
}

analyzeFiles();
