/**
 * ESBuild configuration for userscript optimization
 * @see https://esbuild.github.io/api/
 */
export default {
  // Core build settings
  bundle: true,
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  // Target and platform
  target: "es2022",
  platform: "browser",
  format: "iife",
  // Optimization
  treeShaking: true,
  splitting: false,
  keepNames: false,
  mangleProps: false,
  // Output configuration
  charset: "utf8",
  legalComments: "none",
  sourcemap: false,
  // Logging
  logLevel: "error",
  logLimit: 10,
  // Performance
  metafile: false,
  write: true
};
