/**
 * Node ESM resolver hook used by bin/extract-gutenberg-types.
 *
 * @wordpress/block-editor@15.17.0 ships an extension-less subpath import
 *     import { diffChars } from "diff/lib/diff/character"
 * but diff@9's package.json only exports "./lib/*.js". Under strict Node ESM
 * that fails with ERR_PACKAGE_PATH_NOT_EXPORTED. This hook transparently
 * rewrites such specifiers to have a ".js" suffix so resolution succeeds.
 */
// oxlint-disable-next-line require-await -- Node module-customization resolve hook is async by contract
export async function resolve(specifier, context, nextResolve) {
  if (/^diff\/lib\/.+/.test(specifier) && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
    return nextResolve(specifier + ".js", context)
  }
  return nextResolve(specifier, context)
}
