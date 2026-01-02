export const extractBracedContent = (text: string, startIndex: number): { content: string, endIndex: number } | null => {
    if (text[startIndex] !== '{') return null;
    let depth = 0;
    for (let i = startIndex; i < text.length; i++) {
        // Handle escaped inner braces \{ \}
        if (text[i] === '\\' && (text[i + 1] === '{' || text[i + 1] === '}')) {
            i++; // skip next character
            continue;
        }

        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;

        if (depth === 0) {
            return { content: text.substring(startIndex + 1, i), endIndex: i };
        }
    }
    return null;
};

// Expand a macro with arguments: \cmd{arg1}{arg2} -> template with #1, #2 replaced
export const expandMacro = (text: string, commandName: string, argCount: number, template: string): string => {
    let result = "";
    let cursor = 0;

    // Safety break to prevent infinite loops if something goes wrong
    let safetyCounter = 0;
    const MAX_LOOPS = 10000;

    while (cursor < text.length) {
        if (safetyCounter++ > MAX_LOOPS) {
            console.error("Macro expansion infinite loop detected for:", commandName);
            return result + text.substring(cursor);
        }

        const idx = text.indexOf(commandName, cursor);
        if (idx === -1) {
            result += text.substring(cursor);
            break;
        }

        // Check if it's a real command match (next char is not a letter, or it is end of string)
        // e.g. matching \text vs \textbf
        const nextChar = text[idx + commandName.length];
        if (nextChar && /[a-zA-Z]/.test(nextChar)) {
            result += text.substring(cursor, idx + commandName.length);
            cursor = idx + commandName.length;
            continue;
        }

        result += text.substring(cursor, idx);

        // Scan arguments
        let current = idx + commandName.length;
        const args: string[] = [];
        let success = true;

        for (let i = 0; i < argCount; i++) {
            // Skip whitespace before argument
            while (current < text.length && /\s/.test(text[current])) current++;

            const extracted = extractBracedContent(text, current);
            if (extracted) {
                args.push(extracted.content);
                current = extracted.endIndex + 1;
            } else {
                success = false;
                break;
            }
        }

        if (success) {
            // Replace #1, #2, etc. in template
            let expanded = template;
            args.forEach((arg, i) => {
                // Determine replacement pattern: #1, #2...
                const param = `#${i + 1}`;
                expanded = expanded.split(param).join(arg);
            });
            result += expanded;
            cursor = current;
        } else {
            // Failed to match arguments, keep original
            result += text.substring(idx, current);
            cursor = current;
        }
    }
    return result;
};
