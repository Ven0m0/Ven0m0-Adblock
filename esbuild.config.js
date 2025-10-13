module.exports = {
  entryPoints: [],
  bundle: true,
  minify: true,
  target: ["es2022"],
  platform: "browser",
  legalComments: "none", // Remove all comments (metadata is manually preserved)
  treeShaking: true,
  charset: "utf8",
  format: "iife", // Userscripts: avoid polluting global scope
  logLevel: "error",
};
