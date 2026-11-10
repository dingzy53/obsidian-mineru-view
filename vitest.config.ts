import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["test/**/*.test.ts"],
		// The default worker-thread pool is blocked in some sandboxed/CI
		// environments; child processes work everywhere.
		pool: "forks",
	},
});
