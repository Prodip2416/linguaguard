/**
 * unusedKeys.ts
 *
 * Tool: find_unused_keys
 *
 * Scans the frontend codebase to find all translation keys that are defined
 * in locale files but never actually referenced in any source file.
 *
 * These "dead" keys are safe to remove, reducing translation maintenance cost.
 *
 * Note: Dynamic keys like t(`prefix.${variable}`) cannot be detected statically.
 * A warning is included in the report reminding users to review those manually.
 */
import { readLocaleFiles, getAllKeys } from "../utils/fileReader.js";
import { getUsedKeys, countScannedFiles } from "../utils/codeScanner.js";
// ─── Core logic ───────────────────────────────────────────────────────────────
/**
 * Finds all translation keys defined in locale files that have no matching
 * usage found in the project source code.
 *
 * @param localesPath   Path to the locale JSON files
 * @param languages     Language codes to load
 * @param primaryLang   Primary language (used as the authoritative key set)
 * @param extension     File extension (default: "json")
 * @param projectRoot   Root of the frontend project to scan
 */
export async function findUnusedKeys(localesPath, languages, primaryLang, extension = "json", projectRoot = ".") {
    // Load all locale data
    const localeData = readLocaleFiles(localesPath, languages, extension);
    // Collect all keys defined across any language file
    const allDefinedKeys = getAllKeys(localeData);
    // Scan codebase for keys actually used in source files
    const usedKeys = await getUsedKeys(projectRoot);
    const filesScanned = await countScannedFiles(projectRoot);
    const unusedKeys = [];
    for (const key of allDefinedKeys) {
        if (!usedKeys.has(key)) {
            unusedKeys.push(key);
        }
    }
    unusedKeys.sort(); // alphabetical for readability
    const totalDefined = allDefinedKeys.size;
    const totalUnused = unusedKeys.length;
    const totalUsed = totalDefined - totalUnused;
    const summary = totalUnused === 0
        ? `All ${totalDefined} defined keys are used in the codebase.`
        : `Found ${totalUnused} unused key(s) out of ${totalDefined} total defined.`;
    return {
        summary,
        unusedKeys,
        totalDefined,
        totalUsed,
        totalUnused,
        filesScanned,
    };
}
// ─── MCP tool handler ─────────────────────────────────────────────────────────
/**
 * MCP tool entry point.
 * Reads config from environment variables and returns a formatted report.
 */
export async function runUnusedKeysTool(args) {
    const localesPath = args.locales_path || process.env.LOCALES_PATH || "./src/locales";
    const languages = (args.languages || process.env.LANGUAGES || "en")
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
    const primaryLang = args.primary_lang || process.env.PRIMARY_LANG || "en";
    const extension = args.file_extension || process.env.FILE_EXTENSION || "json";
    const projectRoot = args.project_root || process.env.PROJECT_ROOT || ".";
    try {
        const result = await findUnusedKeys(localesPath, languages, primaryLang, extension, projectRoot);
        return formatUnusedKeysReport(result);
    }
    catch (err) {
        return `Error: ${String(err)}`;
    }
}
// ─── Report formatter ─────────────────────────────────────────────────────────
function formatUnusedKeysReport(result) {
    const lines = [];
    lines.push("# LinguaGuard — Unused Keys Report");
    lines.push("");
    lines.push(`**${result.summary}**`);
    lines.push("");
    lines.push(`- Files scanned: ${result.filesScanned}`);
    lines.push(`- Keys defined:  ${result.totalDefined}`);
    lines.push(`- Keys in use:   ${result.totalUsed}`);
    lines.push(`- Keys unused:   ${result.totalUnused}`);
    if (result.unusedKeys.length > 0) {
        lines.push("");
        lines.push("## Unused Keys");
        for (const key of result.unusedKeys) {
            lines.push(`  - ${key}`);
        }
        lines.push("");
        lines.push("> **Note:** Dynamic keys like `t(\\`prefix.${variable}\\`)` cannot be " +
            "detected statically. Review manually if you use dynamic key patterns.");
    }
    return lines.join("\n");
}
//# sourceMappingURL=unusedKeys.js.map