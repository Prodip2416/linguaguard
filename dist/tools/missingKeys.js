/**
 * missingKeys.ts
 *
 * Tool: find_missing_keys
 *
 * Compares translation keys across all language files and reports which keys
 * are missing in which languages. The primary language acts as the reference —
 * all other languages are expected to have every key defined there.
 *
 * Example output:
 *   "fr" is missing 3 keys: auth.login, auth.logout, common.submit
 *   "bn" is missing 1 key:  common.submit
 */
import { readLocaleFiles, getPrimaryKeys } from "../utils/fileReader.js";
// ─── Core logic ───────────────────────────────────────────────────────────────
/**
 * Finds all keys that exist in the primary language but are absent in
 * one or more other language files.
 *
 * @param localesPath   Path to the folder containing locale JSON files
 * @param languages     List of language codes to check (e.g. ["en","fr","bn"])
 * @param primaryLang   The reference language (e.g. "en")
 * @param extension     File extension (default: "json")
 */
export function findMissingKeys(localesPath, languages, primaryLang, extension = "json") {
    // Load all locale files into a flat map
    const localeData = readLocaleFiles(localesPath, languages, extension);
    // Get the full set of keys from the primary language
    const primaryKeys = getPrimaryKeys(localeData, primaryLang);
    const details = [];
    let totalMissing = 0;
    for (const lang of languages) {
        // Skip the primary language — it's the reference, not checked against itself
        if (lang === primaryLang)
            continue;
        const langKeys = new Set(Object.keys(localeData[lang] ?? {}));
        const missing = [];
        for (const key of primaryKeys) {
            if (!langKeys.has(key)) {
                missing.push(key);
            }
        }
        if (missing.length > 0) {
            details.push({
                language: lang,
                missingKeys: missing.sort(), // alphabetical for readability
                count: missing.length,
            });
            totalMissing += missing.length;
        }
    }
    // Build a human-readable summary
    const summary = totalMissing === 0
        ? `All languages are complete. No missing keys found.`
        : `Found ${totalMissing} missing key(s) across ${details.length} language(s).`;
    return { summary, details, totalMissing };
}
// ─── MCP tool handler ─────────────────────────────────────────────────────────
/**
 * MCP tool entry point.
 * Reads config from environment variables and returns a formatted report.
 */
export function runMissingKeysTool(args) {
    // Allow per-call overrides, otherwise fall back to env vars
    const localesPath = args.locales_path || process.env.LOCALES_PATH || "./src/locales";
    const languages = (args.languages || process.env.LANGUAGES || "en")
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
    const primaryLang = args.primary_lang || process.env.PRIMARY_LANG || "en";
    const extension = args.file_extension || process.env.FILE_EXTENSION || "json";
    try {
        const result = findMissingKeys(localesPath, languages, primaryLang, extension);
        return formatMissingKeysReport(result);
    }
    catch (err) {
        return `Error: ${String(err)}`;
    }
}
// ─── Report formatter ─────────────────────────────────────────────────────────
/**
 * Formats the result into a clean, readable text report for the AI to present.
 */
function formatMissingKeysReport(result) {
    const lines = [];
    lines.push("# LinguaGuard — Missing Keys Report");
    lines.push("");
    lines.push(`**${result.summary}**`);
    if (result.details.length === 0) {
        lines.push("");
        lines.push("Your i18n files are fully in sync.");
        return lines.join("\n");
    }
    for (const lang of result.details) {
        lines.push("");
        lines.push(`## Language: \`${lang.language}\` — ${lang.count} missing key(s)`);
        for (const key of lang.missingKeys) {
            lines.push(`  - ${key}`);
        }
    }
    lines.push("");
    lines.push(`---`);
    lines.push(`Total missing: **${result.totalMissing}** key(s)`);
    return lines.join("\n");
}
//# sourceMappingURL=missingKeys.js.map