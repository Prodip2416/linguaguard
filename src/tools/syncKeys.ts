/**
 * syncKeys.ts
 *
 * Tool: sync_key
 *
 * Adds a new translation key (with a value for the primary language) to ALL
 * language files at once. For non-primary languages, it inserts a placeholder
 * value so the key exists and can be translated later.
 *
 * This keeps all locale files in sync when you add a new feature that needs
 * a new translation string.
 *
 * Example:
 *   Key:   "auth.forgot_password"
 *   Value: "Forgot your password?"  (for primary lang: "en")
 *
 *   → en.json  gets: "auth.forgot_password": "Forgot your password?"
 *   → fr.json  gets: "auth.forgot_password": "[TODO] Forgot your password?"
 *   → bn.json  gets: "auth.forgot_password": "[TODO] Forgot your password?"
 *
 * Supports nested key notation: "auth.forgot_password" creates a nested
 * JSON object structure in the file.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncKeyResult {
  summary: string;
  keyAdded: string;
  primaryValue: string;
  updatedFiles: string[];
  skippedFiles: string[];
  alreadyExisted: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sets a deeply nested key in an object using dot notation.
 * Example: setNestedKey(obj, "auth.login.title", "Login") →
 *   obj.auth.login.title = "Login"
 */
function setNestedKey(
  obj: Record<string, unknown>,
  dotKey: string,
  value: string
): void {
  const parts = dotKey.split(".");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (
      current[part] === undefined ||
      current[part] === null ||
      typeof current[part] !== "object"
    ) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Gets a deeply nested key from an object using dot notation.
 * Returns undefined if any part of the path doesn't exist.
 */
function getNestedKey(
  obj: Record<string, unknown>,
  dotKey: string
): string | undefined {
  const parts = dotKey.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/**
 * Adds a new key to all language files. Writes the original value for the
 * primary language and a "[TODO]" placeholder for others.
 *
 * @param localesPath   Path to the locale files folder
 * @param languages     All language codes (e.g. ["en","fr","bn"])
 * @param primaryLang   Primary language code (e.g. "en")
 * @param key           Dot-notation key to add (e.g. "auth.forgot_password")
 * @param value         Translation value for the primary language
 * @param extension     File extension (default: "json")
 * @param overwrite     If true, overwrites the key if it already exists
 */
export function syncKey(
  localesPath: string,
  languages: string[],
  primaryLang: string,
  key: string,
  value: string,
  extension: string = "json",
  overwrite: boolean = false
): SyncKeyResult {
  const resolvedPath = path.resolve(localesPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Locales directory not found: "${resolvedPath}". Check your LOCALES_PATH setting.`
    );
  }

  const updatedFiles: string[] = [];
  const skippedFiles: string[] = [];
  const alreadyExisted: string[] = [];

  for (const lang of languages) {
    const filePath = path.join(resolvedPath, `${lang}.${extension}`);

    // Read existing content, or start with empty object if file doesn't exist
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        existing = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        skippedFiles.push(lang);
        console.warn(`[LinguaGuard] Skipping ${filePath} — invalid JSON`);
        continue;
      }
    }

    // Check if key already exists
    const existingValue = getNestedKey(existing, key);
    if (existingValue !== undefined && !overwrite) {
      alreadyExisted.push(lang);
      continue; // Don't overwrite unless explicitly asked
    }

    // Determine value: primary lang gets the real value, others get a TODO placeholder
    const insertValue =
      lang === primaryLang ? value : `[TODO] ${value}`;

    // Set the key in the (potentially nested) object
    setNestedKey(existing, key, insertValue);

    // Write back to file with 2-space indent for readability
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
    updatedFiles.push(lang);
  }

  const summary =
    updatedFiles.length === 0
      ? `Key "${key}" already exists in all language files. Use overwrite=true to force update.`
      : `Key "${key}" added to ${updatedFiles.length} language file(s).`;

  return {
    summary,
    keyAdded: key,
    primaryValue: value,
    updatedFiles,
    skippedFiles,
    alreadyExisted,
  };
}

// ─── MCP tool handler ─────────────────────────────────────────────────────────

/**
 * MCP tool entry point.
 * Requires `key` and `value` to be passed as tool arguments.
 */
export function runSyncKeyTool(args: Record<string, unknown>): string {
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

  // These are required
  const key = args.key as string;
  const value = args.value as string;
  const overwrite = Boolean(args.overwrite);

  if (!key || !value) {
    return "Error: Both `key` and `value` arguments are required for sync_key.";
  }

  try {
    const result = syncKey(
      localesPath,
      languages,
      primaryLang,
      key,
      value,
      extension,
      overwrite
    );
    return formatSyncKeyReport(result);
  } catch (err) {
    return `Error: ${String(err)}`;
  }
}

// ─── Report formatter ─────────────────────────────────────────────────────────

function formatSyncKeyReport(result: SyncKeyResult): string {
  const lines: string[] = [];

  lines.push("# LinguaGuard — Key Sync Report");
  lines.push("");
  lines.push(`**${result.summary}**`);
  lines.push("");
  lines.push(`- Key:           \`${result.keyAdded}\``);
  lines.push(`- Primary value: "${result.primaryValue}"`);

  if (result.updatedFiles.length > 0) {
    lines.push("");
    lines.push(`**Updated files:**`);
    for (const lang of result.updatedFiles) {
      lines.push(`  - ${lang}.json`);
    }
  }

  if (result.alreadyExisted.length > 0) {
    lines.push("");
    lines.push(`**Skipped (key already exists):** ${result.alreadyExisted.join(", ")}`);
    lines.push(`  → Pass \`overwrite: true\` to force-update these.`);
  }

  if (result.skippedFiles.length > 0) {
    lines.push("");
    lines.push(
      `**Skipped (invalid JSON):** ${result.skippedFiles.join(", ")} — fix these files manually.`
    );
  }

  return lines.join("\n");
}
