import js from "@eslint/js";
import globals from "globals";
export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {...globals.browser, ...globals.greasemonkey}
    },
    rules: {
      "no-unused-vars": ["error", {argsIgnorePattern: "^_"}]
    }
  },
  {files: ["**/*.user.js"], languageOptions: {sourceType: "script"}},
  {ignores: ["node_modules/", "lists/releases/", "userscripts/dist/", "*.min.js"]}
];
