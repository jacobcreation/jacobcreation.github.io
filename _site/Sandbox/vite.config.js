export default {
	server: {
		host: "0.0.0.0",
		strictPort: true,
		hmr: {
			host: "localhost",
			protocol: "ws",
			port: 5173,
		},
	},
	build: {
		rollupOptions: {
			output: {
				entryFileNames: "[name].[hash].js",
				chunkFileNames: "[name].[hash].js",
				assetFileNames: "[name].[hash].[ext]",
			},
		},
	},
};
