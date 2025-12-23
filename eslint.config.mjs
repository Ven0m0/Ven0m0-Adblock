import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      ".cache/**",
      "lists/releases/**",
      "Filters/**",
      "*.min.js"
    ]
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "eqeqeq": ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "prefer-const": "error",
      "no-var": "warn",
      "semi": ["error", "always"],
      "quotes": [
        "error",
        "double",
        {
          avoidEscape: true,
          allowTemplateLiterals: true
        }
      ],
      "indent": ["error", 2],
      "comma-dangle": ["error", "never"],
      "no-console": "off"
    }
  },
  {
    files: ["**/*.user.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.greasemonkey,
        GM_getValue: "readonly",
        GM_setValue: "readonly",
        GM_deleteValue: "readonly",
        GM_listValues: "readonly",
        GM_addStyle: "readonly",
        GM_xmlhttpRequest: "readonly",
        GM_openInTab: "readonly",
        GM_setClipboard: "readonly",
        GM_info: "readonly",
        unsafeWindow: "readonly"
      }
    }
  },
  {
    files: ["Scripts/**/*.sh", "*.config.js", "*.config.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly"
      }
    }
  }
];
