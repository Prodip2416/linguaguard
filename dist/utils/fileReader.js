/**
 * fileReader.ts
 *
 * Responsible for reading and parsing all locale JSON files from the
 * configured LOCALES_PATH. Returns a structured map of:
 *   { languageCode: { "key.nested": "translated value", ... } }
 *
 * Supports nested JSON objects — they are flattened into dot-notation keys.
 * Example: { "auth": { "login": "Login" } } → { "auth.login": "Login" }
 */
import * as fs from "fs";
import * as path from "path";
// ─── Flatten nested JSON ──────────────────────────────────────────────────────
/**
 * Recursively flattens a nested JSON object into dot-notation keys.
 *
 * Example:
 *   { "auth": { "login": "Login", "logout": "Logout" } }
 *   → { "auth.login": "Login", "auth.logout": "Logout" }
 */
function flattenObject(obj, prefix = "") {
    const result = {};
    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            // Recurse into nested objects
            const nested = flattenObject(value, fullKey);
            Object.assign(result, nested);
        }
        else {
            // Leaf value — store as string
            result[fullKey] = String(value ?? "");
        }
    }
    return result;
}
// ─── Main function ────────────────────────────────────────────────────────────
/**
 * Reads all locale files for the configured languages and returns a
 * flat key-value map per language.
 *
 * @param localesPath  Absolute or relative path to the locales folder
 * @param languages    Array of language codes, e.g. ["en", "fr", "bn"]
 * @param extension    File extension without dot, e.g. "json"
 * @returns            LocaleData map: { langCode: { flatKey: value } }
 */
export function readLocaleFiles(localesPath, languages, extension = "json") {
    const localeData = {};
    // Resolve to absolute path so relative paths work from any working directory
    const resolvedPath = path.resolve(localesPath);
    // Check that the locales folder actually exists
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Locales directory not found: "${resolvedPath}"\n` +
            `Make sure LOCALES_PATH is set correctly in your MCP config.`);
    }
    for (const lang of languages) {
        const filePath = path.join(resolvedPath, `${lang}.${extension}`);
        // If the file doesn't exist for a language, store empty map and continue
        if (!fs.existsSync(filePath)) {
            console.warn(`[LinguaGuard] Warning: Locale file not found: ${filePath}`);
            localeData[lang] = {};
            continue;
        }
        try {
            const rawContent = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(rawContent);
            localeData[lang] = flattenObject(parsed);
        }
        catch (err) {
            // Catch invalid JSON or file read errors
            if (err instanceof SyntaxError) {
                throw new Error(`Invalid JSON in locale file: ${filePath}\n` +
                    `JSON parse error: ${err.message}`);
            }
            throw new Error(`Failed to read locale file: ${filePath}\n${String(err)}`);
        }
    }
    return localeData;
}
/**
 * Returns all unique translation keys across ALL language files combined.
 * This is the full universe of keys the project has defined.
 */
export function getAllKeys(localeData) {
    const allKeys = new Set();
    for (const translations of Object.values(localeData)) {
        for (const key of Object.keys(translations)) {
            allKeys.add(key);
        }
    }
    return allKeys;
}
/**
 * Returns only the keys present in the primary language file.
 * Other languages are expected to have at least these keys.
 */
export function getPrimaryKeys(localeData, primaryLang) {
    const primary = localeData[primaryLang];
    if (!primary) {
        throw new Error(`Primary language "${primaryLang}" not found in loaded locale data.\n` +
            `Check that PRIMARY_LANG matches one of the LANGUAGES values.`);
    }
    return new Set(Object.keys(primary));
}
//# sourceMappingURL=fileReader.js.map