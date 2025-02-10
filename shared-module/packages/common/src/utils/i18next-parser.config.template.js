module.exports = {
  contextSeparator: "_",
  // old catalogs are in version control
  createOldCatalogs: false,
  defaultNamespace: "wrong-namespace-this-should-be-overwritten",
  defaultValue: "__STRING_NOT_TRANSLATED__",
  indentation: 2,
  // Removed should be removed. If wee need them later, we can get them from  version control
  keepRemoved: false,
  keySeparator: ".",
  lexers: {
    hbs: ["HandlebarsLexer"],
    handlebars: ["HandlebarsLexer"],
    htm: ["HTMLLexer"],
    html: ["HTMLLexer"],
    mjs: ["JavascriptLexer"],
    js: ["JavascriptLexer"],
    ts: ["JavascriptLexer"],
    jsx: ["JsxLexer"],
    tsx: ["JsxLexer"],
    default: ["JavascriptLexer"],
  },
  lineEnding: "lf",
  // These are the locales we want to be autogenerated by the cli. We want this to be only english because the potential placeholders are in english and by not putting english placeholders in other languages' translation files we have a way to track which translations are missing.
  locales: ["en"],
  namespaceSeparator: ":",
  output: "./shared-module/packages/common/src/locales/$LOCALE/$NAMESPACE.json",
  pluralSeparator: "_",
  input: [
    "**/*.{js,jsx,ts,tsx}",
    // Use ! to filter out files or directories
    "!**/*.spec.{js,jsx,ts,tsx}",
    "!i18n/**",
    "!**/node_modules/**",
  ],
  sort: true,
  skipDefaultValues: false,
  useKeysAsDefaultValue: false,
  verbose: false,
  failOnWarnings: true,
  customValueTemplate: null,
}
