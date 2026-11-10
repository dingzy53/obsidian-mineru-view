import { builtinModules } from "node:module";

// Both spellings: `fs` and `node:fs` are the same module to Node.
const builtins = [...builtinModules, ...builtinModules.map((name) => `node:${name}`)];

/**
 * Bundle options for `esbuild.config.mjs`. The plugin uses no Node module;
 * `obsidian` and `electron` are provided by the host app.
 */
export const bundleOptions = {
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron", "@codemirror/*", ...builtins],
	format: "cjs",
	platform: "browser",
	target: "es2022",
	treeShaking: true,
};
