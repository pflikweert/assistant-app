import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "react-native": "react-native-web",
    },
  },
  test: {
    environment: "node",
  },
});
