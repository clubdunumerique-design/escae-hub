// @ts-check
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Forcer les types explicites sur les exports publics
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Interdire les any implicites
      "@typescript-eslint/no-explicit-any": "warn",
      // Interdire les variables non utilisées
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Préférer les imports de type explicites
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      // Pas de console.log en production (warn en dev)
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "*.config.mjs", "*.config.ts"],
  }
);

