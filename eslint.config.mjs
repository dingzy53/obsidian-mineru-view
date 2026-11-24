import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: ["main.js", "node_modules/**", "example/**", ".obsidian-cache/**", "wdio.conf.mts", "scripts/**", "test/e2e/**", "test-vault/**"],
	},
	...tseslint.configs.recommended,
	{
		files: ["**/*.ts"],
		rules: {
			// The codebase should not need `any`; AGENTS.md requires a comment
			// justifying any that appears.
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
		},
	},
	{
		// The plugin is desktop only but needs no Node module at all; keep it
		// that way (AGENTS.md rule 2).
		files: ["src/**/*.ts"],
		plugins: { obsidianmd },
		rules: {
			"obsidianmd/no-nodejs-modules": ["error", { isDesktopOnly: false }],
			"@typescript-eslint/no-restricted-imports": [
				"error",
				{ patterns: [{ group: ["electron"], message: "No Electron APIs (AGENTS.md rule 2)." }] },
			],
		},
	},
	{
		// Pure modules: unit-testable without Obsidian (AGENTS.md "Style").
		files: ["src/mineru/**/*.ts", "src/copy/copyFormatter.ts", "src/copy/links.ts", "src/pdf/rect.ts", "src/results/paths.ts", "src/settingsModel.ts", "src/overlay/boxColors.ts", "src/overlay/boxes.ts"],
		rules: {
			"@typescript-eslint/no-restricted-imports": [
				"error",
				{ patterns: [{ group: ["obsidian", "electron"], allowTypeImports: true, message: "This module must stay free of Obsidian imports." }] },
			],
		},
	},
);
