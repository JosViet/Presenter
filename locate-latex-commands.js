const fs = require('fs');
const path = require('path');

const SAMPLE_DATA_DIR = path.join(__dirname, 'sample-data');

const TARGET_COMMANDS = new Set([
    'dapso', 'itemch', 'draw'
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

function locateCommands() {
    try {
        const filePaths = getAllFiles(SAMPLE_DATA_DIR);

        // Results map: command -> Set of filenames
        const results = {};
        TARGET_COMMANDS.forEach(cmd => results[cmd] = new Set());

        filePaths.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');

            // USE SAME REGEX AS SCANNER
            const cmdRegex = /\\([a-zA-Z@]+)/g;
            let match;
            while ((match = cmdRegex.exec(content)) !== null) {
                const cmd = match[1];
                if (TARGET_COMMANDS.has(cmd)) {
                    const relPath = path.relative(SAMPLE_DATA_DIR, file);
                    results[cmd].add(relPath);
                }
            }
        });

        console.log('--- LOCATIONS OF TOP UNHANDLED COMMANDS ---');
        TARGET_COMMANDS.forEach(cmd => {
            const files = Array.from(results[cmd]);
            console.log(`\n\\${cmd} (Found in ${files.length} files):`);
            // Show up to 5 examples
            files.slice(0, 5).forEach(f => console.log(`  - ${f}`));
            if (files.length > 5) console.log(`  ... and ${files.length - 5} more`);
        });

    } catch (e) {
        console.error("Error scanning:", e);
    }
}

locateCommands();
