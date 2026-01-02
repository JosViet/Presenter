import { expandMacro } from '../utils/latex-helpers-v2';

export interface ReplacementRule {
    pattern: string;
    replacement: string;
    flags?: string;
    description?: string;
    numArgs?: number; // If set, treated as a macro (#1, #2...)
}

export interface LatexConfig {
    replacements: ReplacementRule[];
    macros: Record<string, string>;
}

const DEFAULT_CONFIG: LatexConfig = {
    replacements: [], // Start empty to avoid conflict with parser_presenter.ts
    macros: {}
};

export class LatexConfigService {
    private static config: LatexConfig = DEFAULT_CONFIG;
    private static configPath: string = '';

    static async init() {
        try {
            const userDataPath = await window.electronAPI.getPath('userData');
            // Check OS to determine if we need a specific separator, but '/' usually works
            this.configPath = `${userDataPath}/latex-config.json`;
            console.log('Loading LaTeX config from:', this.configPath);

            const exists = await window.electronAPI.exists(this.configPath);
            if (!exists) {
                console.log('Config not found, creating default...');
                await this.saveConfig(DEFAULT_CONFIG);
            } else {
                const content = await window.electronAPI.readFile(this.configPath);
                let loadedConfig = JSON.parse(content);

                // MIGRATION: Remove harmful default rules (heva, hoac, chi) that break the parser
                // These were added by mistake in the previous version
                const harmfulPatterns = ['\\\\heva', '\\\\hoac', '\\\\chi'];
                const filteredReplacements = (loadedConfig.replacements || []).filter((r: ReplacementRule) =>
                    !harmfulPatterns.includes(r.pattern)
                );

                if (filteredReplacements.length !== (loadedConfig.replacements || []).length) {
                    console.log('Detected harmful default rules, auto-removing...');
                    loadedConfig.replacements = filteredReplacements;
                    await this.saveConfig(loadedConfig);
                }

                this.config = loadedConfig;
                console.log('LaTeX config loaded, rules:', this.config.replacements.length);
            }
        } catch (e) {
            console.error('Failed to init LatexConfigService:', e);
        }
    }

    static getConfig(): LatexConfig {
        return this.config;
    }

    static async saveConfig(config: LatexConfig) {
        try {
            await window.electronAPI.writeFile(this.configPath, JSON.stringify(config, null, 2));
            this.config = config;
        } catch (e) {
            console.error('Failed to save LaTeX config:', e);
        }
    }

    static applyReplacements(content: string): string {
        let result = content;
        // Apply dynamic replacements
        for (const rule of this.config.replacements) {
            try {
                if (rule.numArgs !== undefined && rule.numArgs > 0) {
                    // Macro Expansion Mode
                    // We assume rule.pattern is the command name (e.g. "\\heva")
                    result = expandMacro(result, rule.pattern, rule.numArgs, rule.replacement);
                } else {
                    // Regex Mode
                    // Determine flags. Default 'g' if not specified.
                    const flags = rule.flags !== undefined ? rule.flags : 'g';
                    const regex = new RegExp(rule.pattern, flags);
                    result = result.replace(regex, rule.replacement);
                }
            } catch (e) {
                console.warn(`Invalid replacement rule: ${rule.pattern}`, e);
            }
        }
        return result;
    }
}
