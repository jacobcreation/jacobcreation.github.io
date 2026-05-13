import { defineConfig } from "vite";

export default defineConfig({
	base: "./",
	build: {
		outDir: "dist",
		assetsDir: "assets",
		// Ensure three.js examples are bundled correctly
		rollupOptions: {
			output: {
				manualChunks: {
					three: ["three"],
				},
				entryFileNames: "[name].[hash].js",
				chunkFileNames: "[name].[hash].js",
				assetFileNames: "[name].[hash].[ext]",
			},
		},
	},
});
