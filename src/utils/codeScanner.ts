/**
 * codeScanner.ts
 *
 * Scans the frontend codebase (JS/TS/JSX/TSX/Vue/Svelte files) to find
 * all translation key usages. This is used by the unusedKeys tool to
 * determine which keys are actually referenced in code.
 *
 * Detection strategy:
 *   Looks for common i18n patterns such as:
 *   - t("key")           — react-i18next, vue-i18n, i18next
 *   - t('key')
 *   - $t("key")          — Vue template syntax
 *   - i18n.t("key")
 *   - useTranslation("key")
 *   - trans("key")       — some custom helpers
 *   - translate("key")
 *
 * Note: Dynamic keys like t(`prefix.${var}`) cannot be statically detected.
 * Those will be flagged as "possibly unused" — the user must review manually.
 */

import { glob } from "glob";
import * as fs from "fs";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Where a key was found in the codebase */
export interface KeyUsage {
  key: string;
  file: string;
  line: number;
}

// ─── Regex patterns ───────────────────────────────────────────────────────────

/**
 * Matches common i18n function call patterns with a static string key.
 *
 * Captures the key name (group 1) from patterns like:
 *   t("auth.login")
 *   $t('common.submit')
 *   i18n.t("home.title")
 *   translate("error.notFound")
 *   trans("button.cancel")
 */
const I18N_KEY_PATTERN =
  /(?:\$t|i18n\.t|trans|translate|t)\s*\(\s*['"`]([a-zA-Z0-9_.:-]+)['"`]/g;

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Scans all source files in a directory for translation key usages.
 *
 * @param projectRoot  Root directory of the frontend project to scan
 * @returns            Array of KeyUsage objects (key + file + line number)
 */
export async function scanCodeForKeys(
  projectRoot: string
): Promise<KeyUsage[]> {
  const resolvedRoot = path.resolve(projectRoot);

  // Check the project root exists
  if (!fs.existsSync(resolvedRoot)) {
    throw new Error(
      `Project root directory not found: "${resolvedRoot}"\n` +
        `Make sure the path passed to scanCodeForKeys is correct.`
    );
  }

  // Find all relevant source files — JS, TS, JSX, TSX, Vue, Svelte
  const files = await glob(
    `${resolvedRoot}/**/*.{js,ts,jsx,tsx,vue,svelte}`,
    {
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/.next/**",
        "**/.nuxt/**",
        "**/coverage/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.d.ts",
      ],
    }
  );

  const usages: KeyUsage[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      // Search line by line for i18n key usages
      lines.forEach((line, lineIndex) => {
        // Reset regex lastIndex for each line
        I18N_KEY_PATTERN.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = I18N_KEY_PATTERN.exec(line)) !== null) {
          usages.push({
            key: match[1],         // captured key string
            file: file,            // absolute path to file
            line: lineIndex + 1,   // 1-based line number
          });
        }
      });
    } catch {
      // Skip files that can't be read (binary files, permission issues, etc.)
      console.warn(`[LinguaGuard] Skipping unreadable file: ${file}`);
    }
  }

  return usages;
}

/**
 * Returns a Set of all unique translation keys found in the codebase.
 * Convenience wrapper around scanCodeForKeys for tools that only need keys.
 */
export async function getUsedKeys(projectRoot: string): Promise<Set<string>> {
  const usages = await scanCodeForKeys(projectRoot);
  return new Set(usages.map((u) => u.key));
}

/**
 * Returns the count of files scanned for informational purposes
 * (used in the health report tool).
 */
export async function countScannedFiles(projectRoot: string): Promise<number> {
  const resolvedRoot = path.resolve(projectRoot);

  if (!fs.existsSync(resolvedRoot)) return 0;

  const files = await glob(
    `${resolvedRoot}/**/*.{js,ts,jsx,tsx,vue,svelte}`,
    {
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/.next/**",
        "**/.nuxt/**",
        "**/coverage/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.d.ts",
      ],
    }
  );

  return files.length;
}
