import { readdirSync, readFileSync } from "fs"
import { join, relative } from "path"

/**
 * Page content is stored as block JSON, never as serialized block HTML. That is why the custom blocks
 * need no `deprecated` entries: Gutenberg only validates and migrates blocks it parses from HTML, so
 * changing what `edit` or `save` renders cannot invalidate stored content. If a code path starts
 * writing or reading serialized markup, that stops being true and the blocks need real deprecations.
 */
const SOURCE_ROOT = join(import.meta.dirname, "..", "..", "src")

/** The debug modal shows serialized HTML to teachers; nothing persists or re-reads it. */
const FILES_ALLOWED_TO_SERIALIZE = ["components/SerializeGutenbergModal.tsx"]

/** Anything that turns block markup back into blocks, or block state into markup. */
const FORBIDDEN_BLOCK_HTML_IMPORTS = [
  "parse",
  "parseWithAttributeSchema",
  "pasteHandler",
  "rawHandler",
  "serializeRawBlock",
  "getBlockContent",
  "getSaveContent",
  "getSaveElement",
  "isValidBlockContent",
]

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "shared-module" || entry.name === "generated" ? [] : sourceFiles(path)
    }
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [path] : []
  })

const BLOCKS_SPECIFIER = '"@wordpress/blocks"'
const BLOCKS_NAMED_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@wordpress\/blocks"/g
/** `utils/Gutenberg/types.ts` names signatures off the module without importing any value. */
const BLOCKS_TYPE_QUERY = /typeof\s+import\("@wordpress\/blocks"\)/g

/** A file may split its type and value imports of the module, so every statement counts. */
const importedNames = (source: string): string[] => [
  ...new Set(
    [...source.matchAll(BLOCKS_NAMED_IMPORT)].flatMap((match) =>
      (match[1] ?? "")
        .split(",")
        .map((name) =>
          name
            .trim()
            .replace(/^type\s+/, "")
            .split(" as ")[0]
            ?.trim(),
        )
        .filter((name): name is string => Boolean(name)),
    ),
  ),
]

const sources = sourceFiles(SOURCE_ROOT).map((path) => ({
  file: relative(SOURCE_ROOT, path).replaceAll("\\", "/"),
  source: readFileSync(path, "utf8"),
}))

const blocksPackageImports = sources
  .map(({ file, source }) => ({ file, imported: importedNames(source) }))
  .filter(({ imported }) => imported.length > 0)

describe("stored page content stays block JSON", () => {
  it("finds the @wordpress/blocks imports it means to check", () => {
    expect(blocksPackageImports.length).toBeGreaterThan(0)
  })

  it("reaches the package only through forms the checks below can read", () => {
    const unreadableReferences = sources
      .filter(({ source }) =>
        source
          .replaceAll(BLOCKS_NAMED_IMPORT, "")
          .replaceAll(BLOCKS_TYPE_QUERY, "")
          .includes(BLOCKS_SPECIFIER),
      )
      .map(({ file }) => file)

    expect(unreadableReferences).toEqual([])
  })

  it("serializes blocks to HTML only in the debug modal", () => {
    const serializingFiles = blocksPackageImports
      .filter(({ imported }) => imported.includes("serialize"))
      .map(({ file }) => file)

    expect(serializingFiles.toSorted()).toEqual(FILES_ALLOWED_TO_SERIALIZE.toSorted())
  })

  it("never turns block markup back into blocks", () => {
    const parsingImports = blocksPackageImports.flatMap(({ file, imported }) =>
      imported
        .filter((name) => FORBIDDEN_BLOCK_HTML_IMPORTS.includes(name))
        .map((name) => `${file}: ${name}`),
    )

    expect(parsingImports).toEqual([])
  })
})
