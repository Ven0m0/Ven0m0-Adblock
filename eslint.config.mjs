/**
 * ESLint configuration (flat config format)
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 */
import js from "@eslint/js";
import globals from "globals";

export default [
  // Base recommended rules
  js.configs.recommended,

  // General JavaScript files
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.greasemonkey
      }
    },
    rules: {
      // Variable handling
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-redeclare": "error",

      // Best practices
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-var": "warn",
      "prefer-const": "warn",

      // Code quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "warn",
      "no-alert": "warn",

      // Style
      "semi": ["error", "always"],
      "quotes": ["error", "double", { avoidEscape: true }],
      "indent": ["error", 2, { SwitchCase: 1 }],
      "comma-dangle": ["error", "never"]
    }
  },

  // Userscript files (different sourceType)
  {
    files: ["**/*.user.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.greasemonkey,
        GM: "readonly",
        GM_addStyle: "readonly",
        GM_getValue: "readonly",
        GM_setValue: "readonly",
        GM_xmlhttpRequest: "readonly",
        unsafeWindow: "readonly"
      }
    }
  },

  // Build scripts and configs
  {
    files: ["Scripts/**/*.{js,sh}", "*.config.{js,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-console": "off"
    }
  },

  // Files to ignore
  {
    ignores: [
      "node_modules/",
      "dist/",
      "lists/releases/",
      "userscripts/dist/",
      "*.min.js",
      ".git/",
      "coverage/"
    ]
  }
];
