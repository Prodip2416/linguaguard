/**
 * index.ts — LinguaGuard MCP Server Entry Point
 *
 * This is the main file that:
 *   1. Creates the MCP server instance
 *   2. Registers all 7 LinguaGuard tools with their schemas
 *   3. Routes incoming tool calls to the right handler function
 *   4. Starts listening via stdio transport (standard for local MCP servers)
 *
 * How it works:
 *   - Your AI editor (Claude, Cursor, etc.) starts this process
 *   - The editor sends tool call requests over stdin
 *   - This server processes them and sends responses over stdout
 *   - All config comes from environment variables set in your editor's MCP config
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// Import all tool handlers
import { runMissingKeysTool } from "./tools/missingKeys.js";
import { runUnusedKeysTool } from "./tools/unusedKeys.js";
import { runSyncKeyTool } from "./tools/syncKeys.js";
import { runNamingCheckerTool } from "./tools/namingChecker.js";
import { runHealthReportTool } from "./tools/healthReport.js";
import { runAiTranslationTool } from "./tools/aiTranslation.js";
import { runCiGuardTool } from "./tools/ciGuard.js";
// ─── Server setup ─────────────────────────────────────────────────────────────
const server = new McpServer({
    name: "linguaguard",
    version: "1.0.0",
});
// ─── Shared input schema fields ───────────────────────────────────────────────
// These optional fields let users override env vars on a per-call basis.
// If not provided, each tool falls back to the environment variables.
const commonFields = {
    locales_path: z
        .string()
        .optional()
        .describe("Path to locale files folder. Defaults to LOCALES_PATH env var (e.g. ./src/locales)"),
    languages: z
        .string()
        .optional()
        .describe("Comma-separated language codes. Defaults to LANGUAGES env var (e.g. en,fr,bn,ar)"),
    primary_lang: z
        .string()
        .optional()
        .describe("Primary/reference language code. Defaults to PRIMARY_LANG env var (e.g. en)"),
    file_extension: z
        .string()
        .optional()
        .describe("File extension without dot. Defaults to FILE_EXTENSION env var (e.g. json)"),
};
// ─── Tool 1: find_missing_keys ────────────────────────────────────────────────
server.tool("find_missing_keys", "Find translation keys that exist in the primary language file but are missing in one or more other language files. Use this to ensure all languages are fully translated.", {
    ...commonFields,
}, async (args) => {
    const result = runMissingKeysTool(args);
    return { content: [{ type: "text", text: result }] };
});
// ─── Tool 2: find_unused_keys ─────────────────────────────────────────────────
server.tool("find_unused_keys", "Scan the project source code (JS/TS/JSX/TSX/Vue/Svelte files) to find translation keys that are defined in locale files but never used in any source file. Helps clean up dead translations.", {
    ...commonFields,
    project_root: z
        .string()
        .optional()
        .describe("Root directory of the frontend project to scan for key usage. Defaults to PROJECT_ROOT env var or current directory."),
}, async (args) => {
    const result = await runUnusedKeysTool(args);
    return { content: [{ type: "text", text: result }] };
});
// ─── Tool 3: sync_key ─────────────────────────────────────────────────────────
server.tool("sync_key", "Add a new translation key to ALL language files at once. The primary language gets the real value; other languages get a [TODO] placeholder so you know what still needs translating.", {
    ...commonFields,
    key: z
        .string()
        .describe("The translation key to add, in dot notation (e.g. auth.forgot_password or common.submit_button)"),
    value: z
        .string()
        .describe("The translation value for the primary language (e.g. 'Forgot your password?')"),
    overwrite: z
        .boolean()
        .optional()
        .describe("Set to true to overwrite the key if it already exists in a language file. Default: false."),
}, async (args) => {
    const result = runSyncKeyTool(args);
    return { content: [{ type: "text", text: result }] };
});
// ─── Tool 4: check_naming_convention ─────────────────────────────────────────
server.tool("check_naming_convention", "Check all translation keys to ensure they follow a consistent naming style. Detects keys that violate the configured convention (snake_case, camelCase, kebab-case, or PascalCase).", {
    ...commonFields,
    naming_convention: z
        .enum(["snake_case", "camelCase", "kebab-case", "PascalCase"])
        .optional()
        .describe("Naming convention to enforce. Defaults to NAMING_CONVENTION env var (e.g. snake_case)"),
}, async (args) => {
    const result = runNamingCheckerTool(args);
    return { content: [{ type: "text", text: result }] };
});
// ─── Tool 5: i18n_health_report ──────────────────────────────────────────────
server.tool("i18n_health_report", "Generate a full i18n health dashboard for your project. Shows per-language completeness %, missing key counts, unused keys, naming violations, and an overall health score out of 100.", {
    ...commonFields,
    naming_convention: z
        .enum(["snake_case", "camelCase", "kebab-case", "PascalCase"])
        .optional()
        .describe("Naming convention to check against. Defaults to NAMING_CONVENTION env var."),
    project_root: z
        .string()
        .optional()
        .describe("Root directory to scan for key usage. Defaults to PROJECT_ROOT env var or '.'."),
}, async (args) => {
    const result = await runHealthReportTool(args);
    return { content: [{ type: "text", text: result }] };
});
// ─── Tool 6: suggest_translations ────────────────────────────────────────────
server.tool("suggest_translations", "Use Claude AI to automatically suggest translations for missing keys. Finds all keys absent in non-primary languages and asks Claude to translate them from the primary language. Requires ANTHROPIC_API_KEY in env.", {
    ...commonFields,
    max_keys: z
        .number()
        .optional()
        .describe("Maximum number of missing keys to translate per language in one call. Default: 20. Lower this if responses are too slow."),
}, async (args) => {
    const result = await runAiTranslationTool(args);
    return { content: [{ type: "text", text: result }] };
});
// ─── Tool 7: ci_guard ────────────────────────────────────────────────────────
server.tool("ci_guard", "Run a CI/CD safety check for missing translation keys. Returns a pass/fail result and lists all missing keys. Useful in pull request reviews and pre-merge checks. Would exit with code 1 in a real pipeline.", {
    ...commonFields,
}, async (args) => {
    const result = runCiGuardTool(args);
    return { content: [{ type: "text", text: result }] };
});
// ─── Start server ─────────────────────────────────────────────────────────────
/**
 * Connects the MCP server to stdio transport.
 *
 * stdio is the standard transport for locally-run MCP servers:
 *   - Your editor spawns this process
 *   - Reads JSON-RPC messages from stdin
 *   - Writes responses to stdout
 *   - stderr is used for logs/warnings (visible in editor's MCP logs)
 */
async function main() {
    const transport = new StdioServerTransport();
    // Log to stderr so it doesn't interfere with the MCP stdio protocol on stdout
    process.stderr.write("[LinguaGuard] Starting MCP server...\n" +
        `[LinguaGuard] LOCALES_PATH:        ${process.env.LOCALES_PATH ?? "(not set — will use ./src/locales)"}\n` +
        `[LinguaGuard] LANGUAGES:           ${process.env.LANGUAGES ?? "(not set — will use en)"}\n` +
        `[LinguaGuard] PRIMARY_LANG:        ${process.env.PRIMARY_LANG ?? "(not set — will use en)"}\n` +
        `[LinguaGuard] NAMING_CONVENTION:   ${process.env.NAMING_CONVENTION ?? "(not set — will use snake_case)"}\n` +
        `[LinguaGuard] AI Translation:      ${process.env.ANTHROPIC_API_KEY ? "enabled" : "disabled (no ANTHROPIC_API_KEY)"}\n`);
    await server.connect(transport);
    process.stderr.write("[LinguaGuard] Server ready. Waiting for tool calls.\n");
}
main().catch((err) => {
    process.stderr.write(`[LinguaGuard] Fatal error: ${String(err)}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map