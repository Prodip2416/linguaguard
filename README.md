# LinguaGuard — i18n MCP Server

![CI](https://github.com/prodip2416/linguaguard/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![MCP](https://img.shields.io/badge/MCP-compatible-blue)

> Manage your translations directly from your AI editor.  
> Works with Claude Desktop, Cursor, VS Code, Windsurf, Zed, and Cline.

LinguaGuard is a local [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that gives your AI editor superpowers over your i18n setup. Ask your AI natural questions — it automatically calls the right tool behind the scenes.

**No npm publish. No cloud. Runs entirely on your machine.**

---

## What Can It Do?

| When you ask your AI...                          | LinguaGuard runs...          |
|--------------------------------------------------|------------------------------|
| "Which translation keys are missing?"            | `find_missing_keys`          |
| "Are there any unused translation keys?"         | `find_unused_keys`           |
| "Add the key `auth.forgot_password` to all langs"| `sync_key`                   |
| "Check if my keys follow snake_case"             | `check_naming_convention`    |
| "Give me an i18n health report"                  | `i18n_health_report`         |
| "Suggest translations for my missing keys"       | `suggest_translations`       |
| "Run an i18n check for CI/CD"                    | `ci_guard`                   |

---

## Requirements

- **Node.js** v20 or higher (v24 recommended)
- A frontend project with JSON locale files (React, Next.js, Vue, Nuxt, Svelte, etc.)
- An AI editor that supports MCP (see supported editors below)

---

## Quick Start

### Step 1 — Clone and build LinguaGuard

```bash
git clone https://github.com/prodip2416/linguaguard.git
cd linguaguard
npm install
npm run build
```

After build, the server is ready at `dist/index.js`.

### Step 2 — Connect to your editor

Copy the config for your editor from the sections below. Replace `path/to/linguaguard` with the **absolute path** to the folder where you cloned this repo.

### Step 3 — Restart your editor and start asking questions

Open any frontend project and ask your AI:
> "Which i18n keys are missing in my French and Bengali files?"

LinguaGuard will automatically find and check your locale files.

---

## Environment Variables (Configuration)

All config is passed via environment variables in your editor's MCP config:

| Variable            | Required | Default        | Description                                              |
|---------------------|----------|----------------|----------------------------------------------------------|
| `LOCALES_PATH`      | Yes      | `./src/locales`| Path to your locale JSON files folder                    |
| `LANGUAGES`         | Yes      | `en`           | Comma-separated language codes (e.g. `en,fr,bn,ar`)      |
| `PRIMARY_LANG`      | Yes      | `en`           | The reference language all others are compared against   |
| `FILE_EXTENSION`    | No       | `json`         | Locale file extension (currently supports `json`)        |
| `NAMING_CONVENTION` | No       | `snake_case`   | Key style: `snake_case`, `camelCase`, `kebab-case`, `PascalCase` |
| `ANTHROPIC_API_KEY` | No       | —              | Only needed for `suggest_translations`. Omit if you don't use AI translation. Never commit this to git. |
| `PROJECT_ROOT`      | No       | `.`            | Root dir to scan for key usage (for unused key detection)|

### Example locale folder structure

```
src/
└── locales/
    ├── en.json    ← primary language
    ├── fr.json
    ├── bn.json
    └── ar.json
```

Each file is a standard JSON translation file:

```json
{
  "auth": {
    "login": "Log in",
    "logout": "Log out",
    "forgot_password": "Forgot your password?"
  },
  "common": {
    "submit": "Submit",
    "cancel": "Cancel"
  }
}
```

---

## Editor Connection Configs

Replace `path/to/linguaguard` with the **absolute path** to where you cloned this repo.  
Example on Mac: `/Users/yourname/projects/linguaguard`  
Example on Windows: `C:\\Users\\yourname\\projects\\linguaguard`

---

### 1. Claude Desktop

Edit the file: `~/Library/Application Support/Claude/claude_desktop_config.json`  
(Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "linguaguard": {
      "command": "node",
      "args": ["/absolute/path/to/linguaguard/dist/index.js"],
      "env": {
        "LOCALES_PATH": "/absolute/path/to/your-project/src/locales",
        "LANGUAGES": "en,fr,bn,ar",
        "PRIMARY_LANG": "en",
        "FILE_EXTENSION": "json",
        "NAMING_CONVENTION": "snake_case",
        "ANTHROPIC_API_KEY": "your_api_key_here"  // optional — only needed for suggest_translations
      }
    }
  }
}
```

Restart Claude Desktop after saving. You should see LinguaGuard in the tools list.

---

### 2. Cursor

Create or edit the file: `.cursor/mcp.json` in your home directory or project root.

```json
{
  "mcpServers": {
    "linguaguard": {
      "command": "node",
      "args": ["/absolute/path/to/linguaguard/dist/index.js"],
      "env": {
        "LOCALES_PATH": "/absolute/path/to/your-project/src/locales",
        "LANGUAGES": "en,fr,bn,ar",
        "PRIMARY_LANG": "en",
        "FILE_EXTENSION": "json",
        "NAMING_CONVENTION": "snake_case",
        "ANTHROPIC_API_KEY": "your_api_key_here"  // optional — only needed for suggest_translations
      }
    }
  }
}
```

Go to **Cursor Settings → MCP** and verify LinguaGuard appears as a connected server.

---

### 3. VS Code (Claude Extension)

Create the file `.vscode/mcp.json` inside your project folder:

```json
{
  "servers": {
    "linguaguard": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/linguaguard/dist/index.js"],
      "env": {
        "LOCALES_PATH": "/absolute/path/to/your-project/src/locales",
        "LANGUAGES": "en,fr,bn,ar",
        "PRIMARY_LANG": "en",
        "FILE_EXTENSION": "json",
        "NAMING_CONVENTION": "snake_case",
        "ANTHROPIC_API_KEY": "your_api_key_here"  // optional — only needed for suggest_translations
      }
    }
  }
}
```

The Claude VS Code extension picks this up automatically when you open the project.

---

### 4. Windsurf

Edit the file: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "linguaguard": {
      "command": "node",
      "args": ["/absolute/path/to/linguaguard/dist/index.js"],
      "env": {
        "LOCALES_PATH": "/absolute/path/to/your-project/src/locales",
        "LANGUAGES": "en,fr,bn,ar",
        "PRIMARY_LANG": "en",
        "FILE_EXTENSION": "json",
        "NAMING_CONVENTION": "snake_case",
        "ANTHROPIC_API_KEY": "your_api_key_here"  // optional — only needed for suggest_translations
      }
    }
  }
}
```

Restart Windsurf after saving.

---

### 5. Zed

Edit `~/.config/zed/settings.json` and add a `context_servers` section:

```json
{
  "context_servers": {
    "linguaguard": {
      "command": {
        "path": "node",
        "args": ["/absolute/path/to/linguaguard/dist/index.js"],
        "env": {
          "LOCALES_PATH": "/absolute/path/to/your-project/src/locales",
          "LANGUAGES": "en,fr,bn,ar",
          "PRIMARY_LANG": "en",
          "FILE_EXTENSION": "json",
          "NAMING_CONVENTION": "snake_case",
          "ANTHROPIC_API_KEY": "your_api_key_here"
        }
      }
    }
  }
}
```

---

### 6. Cline (VS Code Extension)

Open VS Code **Settings** (`Cmd+,`), switch to JSON view, and add:

```json
{
  "cline.mcpServers": {
    "linguaguard": {
      "command": "node",
      "args": ["/absolute/path/to/linguaguard/dist/index.js"],
      "env": {
        "LOCALES_PATH": "/absolute/path/to/your-project/src/locales",
        "LANGUAGES": "en,fr,bn,ar",
        "PRIMARY_LANG": "en",
        "FILE_EXTENSION": "json",
        "NAMING_CONVENTION": "snake_case",
        "ANTHROPIC_API_KEY": "your_api_key_here"  // optional — only needed for suggest_translations
      }
    }
  }
}
```

---

## Tool Reference

### `find_missing_keys`
Finds keys that exist in the primary language file but are absent in other languages.

**Example prompt:** *"Which keys are missing in my French translation file?"*

---

### `find_unused_keys`
Scans all JS/TS/JSX/TSX/Vue/Svelte source files to find translation keys that are defined but never called in code.

**Example prompt:** *"Do I have any unused translation keys I can delete?"*

> Note: Dynamic keys like `` t(`prefix.${variable}`) `` cannot be detected statically. Review those manually.

---

### `sync_key`
Adds a new key to **all** language files at once. The primary language gets the real value. All other languages get a `[TODO]` placeholder.

**Example prompt:** *"Add the key `auth.reset_password` with value 'Reset your password' to all language files."*

**Parameters:**
- `key` — dot-notation key name (e.g. `auth.reset_password`)
- `value` — the primary language translation
- `overwrite` *(optional)* — set to `true` to overwrite if key already exists

---

### `check_naming_convention`
Checks all translation keys against a naming convention and reports any violations.

**Example prompt:** *"Are all my translation keys following snake_case naming?"*

**Supported conventions:** `snake_case`, `camelCase`, `kebab-case`, `PascalCase`

---

### `i18n_health_report`
Combines all checks into a single dashboard with a health score (0–100).

Shows:
- Per-language completeness %
- Missing key counts
- Unused key count
- Naming violations
- Actionable recommendations

**Example prompt:** *"Give me a full i18n health report for my project."*

---

### `suggest_translations`
Uses the **Claude AI API** to suggest translations for all missing keys. Groups results by language and returns them ready to review.

**Requires:** Your own `ANTHROPIC_API_KEY` in your MCP config env. No key is bundled or shared.

**Example prompt:** *"Suggest French and Bengali translations for my missing keys."*

> Translations are suggestions only — use `sync_key` to apply them after review.

---

### `ci_guard`
Checks for missing keys and returns a pass/fail status with full details. Designed for use in CI/CD pipeline reviews.

**Example prompt:** *"Run an i18n CI check — are we ready to merge?"*

**For actual CI pipelines**, you can run the check directly:

```bash
# In your GitHub Actions / GitLab CI pipeline:
LOCALES_PATH=./src/locales \
LANGUAGES=en,fr,bn,ar \
PRIMARY_LANG=en \
node /path/to/linguaguard/dist/index.js --ci-guard
# Exits with code 0 (pass) or 1 (fail — missing keys found)
```

---

## Example: Full Workflow

1. You add a new feature that needs a translation key
2. Ask your AI: *"Add the key `dashboard.welcome_message` with value 'Welcome back!' to all languages"*
   - LinguaGuard runs `sync_key` → adds to `en.json`, puts `[TODO]` in `fr.json`, `bn.json`, `ar.json`
3. Ask: *"Suggest translations for the missing keys in French and Bengali"*
   - LinguaGuard runs `suggest_translations` → Claude returns translated values
4. Ask: *"Apply the French translation 'Bon retour !' to `dashboard.welcome_message`"*
   - LinguaGuard runs `sync_key` with `overwrite: true` for French
5. Before merging: *"Run the CI guard check"*
   - LinguaGuard runs `ci_guard` → confirms all languages are complete ✅

---

## Troubleshooting

**Server not connecting?**
- Make sure you ran `npm run build` and `dist/index.js` exists
- Use the **absolute path** to `dist/index.js` in your editor config (not relative)
- Check the editor's MCP logs for error messages from LinguaGuard

**"Locales directory not found" error?**
- The `LOCALES_PATH` in your config is relative to where your AI editor launches the server, not where LinguaGuard lives. Use an absolute path to be safe:  
  `"LOCALES_PATH": "/absolute/path/to/your-project/src/locales"`

**`suggest_translations` not working?**
- Make sure `ANTHROPIC_API_KEY` is set in your MCP config env
- The key must be valid and have access to `claude-sonnet-4-5`

**Unused keys tool showing too many false positives?**
- If you use dynamic translation keys like `` t(`nav.${page}`) ``, those can't be detected statically and will appear as "unused". Add a comment or review manually.

---

## Supported Languages

LinguaGuard works with **any language** that uses JSON locale files. The `suggest_translations` tool has built-in AI support for these languages:

| Code | Language         | Code | Language         |
|------|-----------------|------|-----------------|
| `en` | English          | `ko` | Korean           |
| `bn` | Bengali (Bangla) | `hi` | Hindi            |
| `ar` | Arabic           | `tr` | Turkish          |
| `fr` | French           | `pl` | Polish           |
| `de` | German           | `sv` | Swedish          |
| `es` | Spanish          | `da` | Danish           |
| `pt` | Portuguese       | `fi` | Finnish          |
| `it` | Italian          | `no` | Norwegian        |
| `nl` | Dutch            | `uk` | Ukrainian        |
| `ru` | Russian          | `vi` | Vietnamese       |
| `zh` | Chinese (Simplified) | `th` | Thai         |
| `ja` | Japanese         | `id` | Indonesian       |
| `ms` | Malay            | `ro` | Romanian         |
| `cs` | Czech            | `sk` | Slovak           |
| `hu` | Hungarian        | `el` | Greek            |
| `he` | Hebrew           | `fa` | Persian (Farsi)  |

> For any other language not in this list, AI translation will still attempt to translate using the language code directly.

---

## Project Structure

```
linguaguard/
├── src/
│   ├── index.ts                  # MCP server — registers all tools
│   ├── tools/
│   │   ├── missingKeys.ts        # find_missing_keys tool
│   │   ├── unusedKeys.ts         # find_unused_keys tool
│   │   ├── syncKeys.ts           # sync_key tool
│   │   ├── namingChecker.ts      # check_naming_convention tool
│   │   ├── healthReport.ts       # i18n_health_report tool
│   │   ├── aiTranslation.ts      # suggest_translations tool
│   │   └── ciGuard.ts            # ci_guard tool
│   └── utils/
│       ├── fileReader.ts         # reads and flattens locale JSON files
│       └── codeScanner.ts        # scans source files for key usage
├── test-locales/                 # demo locale files for quick testing
│   ├── en.json                   # primary language (complete)
│   ├── fr.json                   # intentionally incomplete — for demo
│   └── bn.json                   # intentionally incomplete — for demo
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions — build + i18n guard
├── dist/                         # compiled output (run npm run build)
├── mcpize.yaml                   # mcpize marketplace config
├── package.json
├── tsconfig.json
└── README.md
```

---

## Try It Out (Demo Locales)

A `test-locales/` folder is included with intentionally incomplete translations so you can try LinguaGuard immediately after setup:

```bash
# Point to the included demo locales
LOCALES_PATH=./test-locales LANGUAGES=en,fr,bn PRIMARY_LANG=en node dist/index.js --ci-guard
```

`fr` and `bn` are missing several keys — perfect for testing `find_missing_keys` and `suggest_translations`.

---

## Build Commands

```bash
npm run build    # compile TypeScript → dist/
npm run clean    # delete dist/ folder
npm run dev      # run directly with tsx (dev only, requires tsx)
npm start        # run compiled server: node dist/index.js
```

---

## License

MIT — free to use, modify, and distribute.
