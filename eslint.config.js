import js from "@eslint/js";
import userscripts from "eslint-plugin-userscripts";
import globals from "globals";

export default [
  {
    files: ["userscripts/src/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.greasemonkey,
        // provided by @require libraries in gh-pro
        GM_config: "readonly",
        waitForElems: "readonly"
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", { caughtErrorsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["userscripts/src/**/*.user.js"],
    plugins: { userscripts },
    rules: {
      ...userscripts.configs.recommended.rules,
      // demands both @homepage and @homepageURL; one is enough for every supported manager
      "userscripts/use-homepage-and-url": "off"
    }
  },
  {
    files: ["userscripts/tests/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      globals: { ...globals.node, Bun: "readonly" }
    }
  }
];
