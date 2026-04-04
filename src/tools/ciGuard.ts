/**
 * ciGuard.ts
 *
 * Tool: ci_guard
 *
 * Designed for use in CI/CD pipelines (GitHub Actions, GitLab CI, etc.).
 * Checks for missing translation keys and returns an exit code that can
 * fail a pipeline when issues are found.
 *
 * How to use in a pipeline:
 *   node dist/index.js --ci-guard
 *   → exits with code 0 if all good
 *   → exits with code 1 if missing keys found
 *
 * As an MCP tool, it returns the same result as a formatted report —
 * the AI can surface this to the developer during their workflow.
 *
 * Can also be used as a standalone CLI script:
 *   node dist/ciGuard.js
 */

import { readLocaleFiles, getPrimaryKeys } from "../utils/fileReader.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CiGuardResult {
  passed: boolean;           // true = no issues found, false = pipeline should fail
  exitCode: 0 | 1;          // 0 = pass, 1 = fail
  totalMissing: number;
  details: CiLanguageIssue[];
  summary: string;
}

export interface CiLanguageIssue {
  language: string;
  missingKeys: string[];
  count: number;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/**
 * Runs the CI guard check. Returns a result object — callers decide
 * whether to call process.exit() or just return the result as a string.
 */
export function runCiGuardCheck(
  localesPath: string,
  languages: string[],
  primaryLang: string,
  extension: string = "json"
): CiGuardResult {
  const localeData = readLocaleFiles(localesPath, languages, extension);
  const primaryKeys = getPrimaryKeys(localeData, primaryLang);

  const details: CiLanguageIssue[] = [];
  let totalMissing = 0;

  for (const lang of languages) {
    if (lang === primaryLang) continue;

    const langKeys = new Set(Object.keys(localeData[lang] ?? {}));
    const missing: string[] = [];

    for (const key of primaryKeys) {
      if (!langKeys.has(key)) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      details.push({
        language: lang,
        missingKeys: missing.sort(),
        count: missing.length,
      });
      totalMissing += missing.length;
    }
  }

  const passed = totalMissing === 0;
  const exitCode = passed ? 0 : 1;

  const summary = passed
    ? `CI Check PASSED — All language files are complete. No missing keys.`
    : `CI Check FAILED — ${totalMissing} missing key(s) found across ${details.length} language(s). Fix before merging.`;

  return { passed, exitCode, totalMissing, details, summary };
}

// ─── MCP tool handler ─────────────────────────────────────────────────────────

/**
 * MCP tool version — returns a string report (does NOT call process.exit).
 * The AI presents this to the developer during their workflow.
 */
export function runCiGuardTool(args: Record<string, unknown>): string {
  const localesPath =
    (args.locales_path as string) || process.env.LOCALES_PATH || "./src/locales";
  const languages = (
    (args.languages as string) || process.env.LANGUAGES || "en"
  )
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  const primaryLang =
    (args.primary_lang as string) || process.env.PRIMARY_LANG || "en";
  const extension =
    (args.file_extension as string) || process.env.FILE_EXTENSION || "json";

  try {
    const result = runCiGuardCheck(localesPath, languages, primaryLang, extension);
    return formatCiGuardReport(result);
  } catch (err) {
    return `Error: ${String(err)}`;
  }
}

// ─── Standalone CLI mode ──────────────────────────────────────────────────────

/**
 * When this file is run directly as a CLI script (e.g. `node dist/ciGuard.js`)
 * it performs the check and exits with the appropriate code.
 *
 * Usage in CI yaml:
 *   - run: node dist/ciGuard.js
 *     env:
 *       LOCALES_PATH: ./src/locales
 *       LANGUAGES: en,fr,bn,ar
 *       PRIMARY_LANG: en
 */
export function runCiGuardCli(): void {
  const localesPath = process.env.LOCALES_PATH || "./src/locales";
  const languages = (process.env.LANGUAGES || "en")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  const primaryLang = process.env.PRIMARY_LANG || "en";
  const extension = process.env.FILE_EXTENSION || "json";

  try {
    const result = runCiGuardCheck(localesPath, languages, primaryLang, extension);

    // Print the report to stdout
    console.log(formatCiGuardReport(result));

    // Exit with the appropriate code — this is what CI/CD systems read
    process.exit(result.exitCode);
  } catch (err) {
    console.error(`[LinguaGuard CI] Fatal error: ${String(err)}`);
    process.exit(1);
  }
}

// ─── Report formatter ─────────────────────────────────────────────────────────

function formatCiGuardReport(result: CiGuardResult): string {
  const lines: string[] = [];
  const statusIcon = result.passed ? "✅" : "❌";

  lines.push("# LinguaGuard — CI/CD Guard Report");
  lines.push("");
  lines.push(`## Status: ${statusIcon} ${result.passed ? "PASSED" : "FAILED"}`);
  lines.push("");
  lines.push(`**${result.summary}**`);

  if (result.details.length > 0) {
    lines.push("");
    lines.push("## Missing Keys by Language");

    for (const lang of result.details) {
      lines.push("");
      lines.push(`### \`${lang.language}\` — ${lang.count} missing key(s)`);
      for (const key of lang.missingKeys) {
        lines.push(`  - ${key}`);
      }
    }

    lines.push("");
    lines.push("---");
    lines.push(
      `**Action required:** Add the missing keys to the affected language files ` +
        `or use the \`sync_key\` tool to propagate them. ` +
        `This check would exit with code **1** in a CI pipeline.`
    );
  } else {
    lines.push("");
    lines.push(
      "All language files are fully translated. This check exits with code **0**."
    );
  }

  return lines.join("\n");
}
