import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "Filters/**",
      "lists/releases/**",
      "lists/mirror/**",
      "*.min.js",
      "*.bundle.js"
    ]
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "prefer-const": "error",
      "no-var": "warn",
      semi: ["error", "always"],
      quotes: ["error", "double", { avoidEscape: true }],
      indent: ["error", 2],
      "comma-dangle": ["error", "never"],
      "no-console": "off"
    }
  },
  {
    files: ["**/*.user.js", "userscripts/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.greasemonkey,
        GM_getValue: "readonly",
        GM_setValue: "readonly",
        GM_addStyle: "readonly",
        GM_xmlhttpRequest: "readonly",
        GM_info: "readonly",
        GM_config: "readonly",
        unsafeWindow: "readonly",
        waitForElems: "readonly"
      }
    }
  }
];
