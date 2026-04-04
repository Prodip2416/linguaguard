/**
 * aiTranslation.ts
 *
 * Tool: suggest_translations
 *
 * Uses the Claude API to suggest translations for keys that are missing in
 * one or more language files. Finds missing keys automatically (same logic as
 * missingKeys.ts) and sends them to Claude with instructions to translate
 * from the primary language into each missing language.
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 * Model: claude-sonnet-4-20250514
 *
 * The tool returns suggestions only — it does NOT write to locale files
 * automatically. Use sync_key to apply specific translations after review.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readLocaleFiles, getPrimaryKeys } from "../utils/fileReader.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranslationSuggestion {
  key: string;
  language: string;
  suggestedValue: string;
}

export interface AiTranslationResult {
  summary: string;
  suggestions: TranslationSuggestion[];
  totalSuggestions: number;
}

// ─── Language name map ────────────────────────────────────────────────────────

/**
 * Maps language codes to their full English names so Claude understands
 * which language to translate into.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  bn: "Bengali (Bangla)",
  ar: "Arabic",
  fr: "French",
  de: "German",
  es: "Spanish",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  ru: "Russian",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ko: "Korean",
  hi: "Hindi",
  tr: "Turkish",
  pl: "Polish",
  sv: "Swedish",
  da: "Danish",
  fi: "Finnish",
  no: "Norwegian",
  uk: "Ukrainian",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
  ms: "Malay",
  ro: "Romanian",
  cs: "Czech",
  sk: "Slovak",
  hu: "Hungarian",
  el: "Greek",
  he: "Hebrew",
  fa: "Persian (Farsi)",
};

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/**
 * Finds missing keys, then asks Claude to suggest translations for them.
 *
 * @param localesPath   Path to locale files
 * @param languages     All language codes
 * @param primaryLang   Reference language code
 * @param extension     File extension
 * @param maxKeys       Max number of missing keys to translate in one call (default 20)
 */
export async function suggestTranslations(
  localesPath: string,
  languages: string[],
  primaryLang: string,
  extension: string = "json",
  maxKeys: number = 20
): Promise<AiTranslationResult> {
  // 1. Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your MCP server env config to use AI translation."
    );
  }

  // 2. Load locale data and find missing keys
  const localeData = readLocaleFiles(localesPath, languages, extension);
  const primaryKeys = getPrimaryKeys(localeData, primaryLang);
  const primaryTranslations = localeData[primaryLang];

  // Collect missing keys per language: { "fr": ["key1", "key2"], ... }
  const missingPerLang: Record<string, string[]> = {};

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
      missingPerLang[lang] = missing;
    }
  }

  const allMissing = Object.values(missingPerLang).flat();
  if (allMissing.length === 0) {
    return {
      summary: "No missing keys found — nothing to translate!",
      suggestions: [],
      totalSuggestions: 0,
    };
  }

  // 3. Build a prompt for Claude listing what needs translating
  const client = new Anthropic({ apiKey });
  const suggestions: TranslationSuggestion[] = [];

  // Process each language separately for cleaner responses
  for (const [lang, missingKeys] of Object.entries(missingPerLang)) {
    // Limit number of keys per request to avoid token overflow
    const keysToTranslate = missingKeys.slice(0, maxKeys);
    const langName = getLanguageName(lang);
    const primaryLangName = getLanguageName(primaryLang);

    // Build key-value list for the prompt
    const keyValueList = keysToTranslate
      .map((key) => {
        const value = primaryTranslations[key] ?? key;
        return `  "${key}": "${value}"`;
      })
      .join("\n");

    const prompt = `You are an expert translator helping to localise a web application.

Translate the following UI text strings from ${primaryLangName} into ${langName}.

Rules:
- Keep the same tone and formality as the source
- Preserve any placeholder variables like {name}, {count}, %s, etc. exactly as-is
- Return ONLY a valid JSON object with the exact same keys as given, no markdown, no explanation
- If a string is already a proper name or brand, do not translate it

Source strings (${primaryLangName}):
{
${keyValueList}
}

Return the ${langName} translations as a JSON object with the same keys:`;

    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });

      // Extract text content from the response
      const responseText = message.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { type: "text"; text: string }).text)
        .join("");

      // Parse the JSON response
      const parsed = JSON.parse(responseText.trim()) as Record<string, string>;

      for (const key of keysToTranslate) {
        if (parsed[key]) {
          suggestions.push({
            key,
            language: lang,
            suggestedValue: parsed[key],
          });
        }
      }
    } catch (err) {
      // Don't fail the whole tool if one language fails — add a note instead
      console.warn(
        `[LinguaGuard] Failed to get translations for "${lang}": ${String(err)}`
      );
      suggestions.push({
        key: "_error",
        language: lang,
        suggestedValue: `Translation request failed: ${String(err)}`,
      });
    }
  }

  const totalSuggestions = suggestions.filter((s) => s.key !== "_error").length;
  const summary = `Generated ${totalSuggestions} translation suggestion(s) across ${Object.keys(missingPerLang).length} language(s).`;

  return { summary, suggestions, totalSuggestions };
}

// ─── MCP tool handler ─────────────────────────────────────────────────────────

export async function runAiTranslationTool(
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
  const maxKeys = Number(args.max_keys) || 20;

  try {
    const result = await suggestTranslations(
      localesPath,
      languages,
      primaryLang,
      extension,
      maxKeys
    );
    return formatAiTranslationReport(result);
  } catch (err) {
    return `Error: ${String(err)}`;
  }
}

// ─── Report formatter ─────────────────────────────────────────────────────────

function formatAiTranslationReport(result: AiTranslationResult): string {
  const lines: string[] = [];

  lines.push("# LinguaGuard — AI Translation Suggestions");
  lines.push("");
  lines.push(`**${result.summary}**`);

  if (result.suggestions.length === 0) {
    return lines.join("\n");
  }

  // Group by language for readability
  const byLang: Record<string, TranslationSuggestion[]> = {};
  for (const s of result.suggestions) {
    if (!byLang[s.language]) byLang[s.language] = [];
    byLang[s.language].push(s);
  }

  for (const [lang, sug] of Object.entries(byLang)) {
    lines.push("");
    lines.push(`## Language: \`${lang}\` — ${sug.length} suggestion(s)`);
    lines.push("");

    for (const s of sug) {
      if (s.key === "_error") {
        lines.push(`> ⚠️ ${s.suggestedValue}`);
      } else {
        lines.push(`- \`${s.key}\`:`);
        lines.push(`  → "${s.suggestedValue}"`);
      }
    }
  }

  lines.push("");
  lines.push("---");
  lines.push(
    "> These are AI-generated suggestions. Review before using. " +
      "Use the `sync_key` tool to apply individual translations."
  );

  return lines.join("\n");
}
