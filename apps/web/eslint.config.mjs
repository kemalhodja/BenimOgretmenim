import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "e2e/**",
    "playwright.config.ts",
  ]),
  {
    rules: {
      /**
       * Bu kural React 19 + client-side token akışlarında çok agresif.
       * Uygulama akışımız (localStorage token okuma + yönlendirme, async fetch) için
       * false-positive üretiyor.
       */
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
