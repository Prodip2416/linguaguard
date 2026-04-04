/**
 * healthReport.ts
 *
 * Tool: i18n_health_report
 *
 * Generates an overall health report for the project's i18n setup.
 * Combines data from multiple checks into a single dashboard-style report:
 *
 *   ✅ Completeness  — % of keys present in each language
 *   ⚠️  Missing keys  — how many keys are absent per language
 *   🗑  Unused keys   — keys defined but not used in code
 *   📋 Naming issues — keys that break the naming convention
 *   📊 Overall score — a simple 0–100 health score
 */

import { readLocaleFiles, getAllKeys, getPrimaryKeys } from "../utils/fileReader.js";
import { getUsedKeys, countScannedFiles } from "../utils/codeScanner.js";
import { checkNamingConvention, NamingConvention } from "./namingChecker.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LanguageHealth {
  language: string;
  totalKeys: number;
  presentKeys: number;
  missingKeys: number;
  completenessPercent: number;
}

export interface HealthReportResult {
  overallScore: number;           // 0–100
  primaryLang: string;
  primaryKeyCount: number;
  languageHealth: LanguageHealth[];
  unusedKeyCount: number;
  namingViolationCount: number;
  filesScanned: number;
  summary: string;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/**
 * Runs all health checks and combines them into a single report.
 */
export async function generateHealthReport(
  localesPath: string,
  languages: string[],
  primaryLang: string,
  extension: string = "json",
  convention: NamingConvention = "snake_case",
  projectRoot: string = "."
): Promise<HealthReportResult> {
  // 1. Load locale data
  const localeData = readLocaleFiles(localesPath, languages, extension);
  const primaryKeys = getPrimaryKeys(localeData, primaryLang);
  const primaryKeyCount = primaryKeys.size;

  // 2. Per-language completeness
  const languageHealth: LanguageHealth[] = [];

  for (const lang of languages) {
    if (lang === primaryLang) {
      // Primary language is always 100% complete (it's the reference)
      languageHealth.push({
        language: lang,
        totalKeys: primaryKeyCount,
        presentKeys: primaryKeyCount,
        missingKeys: 0,
        completenessPercent: 100,
      });
      continue;
    }

    const langKeys = new Set(Object.keys(localeData[lang] ?? {}));
    let presentKeys = 0;

    for (const key of primaryKeys) {
      if (langKeys.has(key)) presentKeys++;
    }

    const missingKeys = primaryKeyCount - presentKeys;
    const completenessPercent =
      primaryKeyCount === 0
        ? 100
        : Math.round((presentKeys / primaryKeyCount) * 100);

    languageHealth.push({
      language: lang,
      totalKeys: primaryKeyCount,
      presentKeys,
      missingKeys,
      completenessPercent,
    });
  }

  // 3. Unused keys
  const allDefinedKeys = getAllKeys(localeData);
  const usedKeys = await getUsedKeys(projectRoot);
  const filesScanned = await countScannedFiles(projectRoot);

  let unusedKeyCount = 0;
  for (const key of allDefinedKeys) {
    if (!usedKeys.has(key)) unusedKeyCount++;
  }

  // 4. Naming convention violations
  let namingViolationCount = 0;
  try {
    const namingResult = checkNamingConvention(
      localesPath,
      languages,
      convention,
      extension
    );
    namingViolationCount = namingResult.totalViolations;
  } catch {
    // If naming check fails, don't crash the whole report
    namingViolationCount = -1; // -1 = "could not check"
  }

  // 5. Calculate overall health score (0–100)
  //    Formula: average completeness across non-primary languages,
  //    penalised for unused keys and naming violations
  const nonPrimaryLangs = languageHealth.filter(
    (l) => l.language !== primaryLang
  );

  const avgCompleteness =
    nonPrimaryLangs.length === 0
      ? 100
      : nonPrimaryLangs.reduce((sum, l) => sum + l.completenessPercent, 0) /
        nonPrimaryLangs.length;

  // Penalise: -1 point per unused key (max -20), -1 point per naming violation (max -10)
  const unusedPenalty = Math.min(unusedKeyCount, 20);
  const namingPenalty =
    namingViolationCount < 0 ? 0 : Math.min(namingViolationCount, 10);

  const overallScore = Math.max(
    0,
    Math.round(avgCompleteness - unusedPenalty - namingPenalty)
  );

  // 6. Summary sentence
  const summary =
    overallScore >= 90
      ? "Excellent! Your i18n setup is in great shape."
      : overallScore >= 70
      ? "Good, but a few things need attention."
      : overallScore >= 50
      ? "Fair — several i18n issues should be resolved."
      : "Poor — significant i18n issues detected. Action required.";

  return {
    overallScore,
    primaryLang,
    primaryKeyCount,
    languageHealth,
    unusedKeyCount,
    namingViolationCount,
    filesScanned,
    summary,
  };
}

// ─── MCP tool handler ─────────────────────────────────────────────────────────

export async function runHealthReportTool(
  args: Record<string, unknown>
): Promise<string> {
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
  const convention =
    ((args.naming_convention as string) ||
      process.env.NAMING_CONVENTION ||
      "snake_case") as NamingConvention;
  const projectRoot =
    (args.project_root as string) || process.env.PROJECT_ROOT || ".";

  try {
    const result = await generateHealthReport(
      localesPath,
      languages,
      primaryLang,
      extension,
      convention,
      projectRoot
    );
    return formatHealthReport(result);
  } catch (err) {
    return `Error: ${String(err)}`;
  }
}

// ─── Report formatter ─────────────────────────────────────────────────────────

function formatHealthReport(result: HealthReportResult): string {
  const lines: string[] = [];

  // Score badge
  const scoreEmoji =
    result.overallScore >= 90
      ? "🟢"
      : result.overallScore >= 70
      ? "🟡"
      : result.overallScore >= 50
      ? "🟠"
      : "🔴";

  lines.push("# LinguaGuard — i18n Health Report");
  lines.push("");
  lines.push(
    `## Overall Score: ${scoreEmoji} **${result.overallScore}/100**`
  );
  lines.push(`> ${result.summary}`);
  lines.push("");

  // Stats overview
  lines.push("## Overview");
  lines.push(`- Primary language:   \`${result.primaryLang}\``);
  lines.push(`- Total keys (primary): ${result.primaryKeyCount}`);
  lines.push(`- Unused keys:        ${result.unusedKeyCount}`);
  lines.push(
    `- Naming violations:  ${
      result.namingViolationCount < 0 ? "N/A" : result.namingViolationCount
    }`
  );
  lines.push(`- Source files scanned: ${result.filesScanned}`);

  // Per-language completeness table
  lines.push("");
  lines.push("## Language Completeness");
  lines.push("");
  lines.push("| Language | Keys Present | Missing | Completeness |");
  lines.push("|----------|-------------|---------|--------------|");

  for (const lang of result.languageHealth) {
    const bar = completenessBar(lang.completenessPercent);
    lines.push(
      `| \`${lang.language}\` | ${lang.presentKeys}/${lang.totalKeys} | ${lang.missingKeys} | ${bar} ${lang.completenessPercent}% |`
    );
  }

  // Recommendations
  const recommendations: string[] = [];

  const incompleteLangs = result.languageHealth.filter(
    (l) => l.completenessPercent < 100
  );
  if (incompleteLangs.length > 0) {
    recommendations.push(
      `Run \`find_missing_keys\` to see exactly which keys are missing in: ${incompleteLangs
        .map((l) => l.language)
        .join(", ")}`
    );
  }
  if (result.unusedKeyCount > 0) {
    recommendations.push(
      `Run \`find_unused_keys\` to review ${result.unusedKeyCount} potentially dead key(s).`
    );
  }
  if (result.namingViolationCount > 0) {
    recommendations.push(
      `Run \`check_naming_convention\` to see ${result.namingViolationCount} naming violation(s).`
    );
  }

  if (recommendations.length > 0) {
    lines.push("");
    lines.push("## Recommendations");
    for (const rec of recommendations) {
      lines.push(`- ${rec}`);
    }
  }

  return lines.join("\n");
}

/** Returns a simple ASCII progress bar for a completeness percentage */
function completenessBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}
