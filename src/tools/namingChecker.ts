/**
 * namingChecker.ts
 *
 * Tool: check_naming_convention
 *
 * Scans all translation keys and checks whether they follow the configured
 * naming convention. Flags any key that violates the expected style.
 *
 * Supported naming conventions:
 *   - snake_case      → auth.forgot_password  (words separated by underscore)
 *   - camelCase       → auth.forgotPassword   (first word lowercase, rest Title)
 *   - kebab-case      → auth.forgot-password  (words separated by hyphen)
 *   - PascalCase      → Auth.ForgotPassword   (every word Capitalised)
 *
 * Each "segment" of a dot-separated key is checked independently.
 * Example: "auth.forgot_password" → segments ["auth", "forgot_password"]
 * In snake_case mode, both segments are valid.
 */

import { readLocaleFiles, getAllKeys } from "../utils/fileReader.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NamingConvention = "snake_case" | "camelCase" | "kebab-case" | "PascalCase";

export interface NamingViolation {
  key: string;
  violatingSegment: string;
  expected: NamingConvention;
}

export interface NamingCheckResult {
  summary: string;
  convention: NamingConvention;
  violations: NamingViolation[];
  totalKeys: number;
  totalViolations: number;
}

// ─── Convention validators ────────────────────────────────────────────────────

/**
 * Each validator returns true if the segment follows the convention.
 * We test individual dot-separated segments, not the full key.
 */
const validators: Record<NamingConvention, (segment: string) => boolean> = {
  // snake_case: only lowercase letters, digits, and underscores
  snake_case: (s) => /^[a-z0-9_]+$/.test(s),

  // camelCase: starts with lowercase, may contain uppercase letters (no separators)
  camelCase: (s) => /^[a-z][a-zA-Z0-9]*$/.test(s),

  // kebab-case: only lowercase letters, digits, and hyphens
  "kebab-case": (s) => /^[a-z0-9-]+$/.test(s),

  // PascalCase: starts with uppercase, may contain uppercase/lowercase letters
  PascalCase: (s) => /^[A-Z][a-zA-Z0-9]*$/.test(s),
};

// ─── Core logic ───────────────────────────────────────────────────────────────

/**
 * Checks all translation keys against the configured naming convention.
 *
 * @param localesPath   Path to locale files
 * @param languages     Language codes to load
 * @param convention    The expected naming convention
 * @param extension     File extension (default: "json")
 */
export function checkNamingConvention(
  localesPath: string,
  languages: string[],
  convention: NamingConvention,
  extension: string = "json"
): NamingCheckResult {
  const localeData = readLocaleFiles(localesPath, languages, extension);
  const allKeys = getAllKeys(localeData);

  const validate = validators[convention];
  if (!validate) {
    throw new Error(
      `Unknown naming convention: "${convention}". ` +
        `Valid options: snake_case, camelCase, kebab-case, PascalCase`
    );
  }

  const violations: NamingViolation[] = [];

  for (const key of allKeys) {
    // Split the key on dots and validate each segment independently
    const segments = key.split(".");

    for (const segment of segments) {
      if (!validate(segment)) {
        violations.push({
          key,
          violatingSegment: segment,
          expected: convention,
        });
        break; // Report each key only once (on first violating segment)
      }
    }
  }

  violations.sort((a, b) => a.key.localeCompare(b.key));

  const totalKeys = allKeys.size;
  const totalViolations = violations.length;

  const summary =
    totalViolations === 0
      ? `All ${totalKeys} keys follow the "${convention}" convention.`
      : `Found ${totalViolations} key(s) violating the "${convention}" convention.`;

  return {
    summary,
    convention,
    violations,
    totalKeys,
    totalViolations,
  };
}

// ─── MCP tool handler ─────────────────────────────────────────────────────────

export function runNamingCheckerTool(args: Record<string, unknown>): string {
  const localesPath =
    (args.locales_path as string) || process.env.LOCALES_PATH || "./src/locales";
  const languages = (
    (args.languages as string) || process.env.LANGUAGES || "en"
  )
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  const extension =
    (args.file_extension as string) || process.env.FILE_EXTENSION || "json";

  // Convention can come from env var or tool argument
  const rawConvention =
    (args.naming_convention as string) ||
    process.env.NAMING_CONVENTION ||
    "snake_case";

  const validConventions: NamingConvention[] = [
    "snake_case",
    "camelCase",
    "kebab-case",
    "PascalCase",
  ];
  if (!validConventions.includes(rawConvention as NamingConvention)) {
    return (
      `Error: Invalid naming_convention "${rawConvention}". ` +
      `Valid options: ${validConventions.join(", ")}`
    );
  }

  const convention = rawConvention as NamingConvention;

  try {
    const result = checkNamingConvention(localesPath, languages, convention, extension);
    return formatNamingCheckReport(result);
  } catch (err) {
    return `Error: ${String(err)}`;
  }
}

// ─── Report formatter ─────────────────────────────────────────────────────────

function formatNamingCheckReport(result: NamingCheckResult): string {
  const lines: string[] = [];

  lines.push("# LinguaGuard — Naming Convention Report");
  lines.push("");
  lines.push(`Convention checked: \`${result.convention}\``);
  lines.push(`Total keys:         ${result.totalKeys}`);
  lines.push(`Violations found:   ${result.totalViolations}`);
  lines.push("");
  lines.push(`**${result.summary}**`);

  if (result.violations.length > 0) {
    lines.push("");
    lines.push("## Violating Keys");
    lines.push("");
    lines.push(
      "| Key | Violating Segment | Expected Convention |"
    );
    lines.push(
      "|-----|-------------------|---------------------|"
    );

    for (const v of result.violations) {
      lines.push(
        `| \`${v.key}\` | \`${v.violatingSegment}\` | ${v.expected} |`
      );
    }
  }

  return lines.join("\n");
}
