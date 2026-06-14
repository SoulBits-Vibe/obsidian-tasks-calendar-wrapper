import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		setupFiles: ["./tests/setup.ts"],
	},
	resolve: {
		alias: {
			"obsidian": resolve(__dirname, "tests/mocks/obsidian.ts"),
			"dataview-util": resolve(__dirname, "dataview-util"),
			"Obsidian-Tasks-Timeline": resolve(__dirname, "Obsidian-Tasks-Timeline"),
			"utils": resolve(__dirname, "utils"),
			"src": resolve(__dirname, "src"),
		},
	},
});
