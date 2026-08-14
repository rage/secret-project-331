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

const blocksPackageImports = sourceFiles(SOURCE_ROOT)
  .map((path) => {
    const match = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@wordpress\/blocks"/s.exec(
      readFileSync(path, "utf8"),
    )
    return {
      file: relative(SOURCE_ROOT, path).replaceAll("\\", "/"),
      imported: (match?.[1] ?? "")
        .split(",")
        .map((name) =>
          name
            .trim()
            .replace(/^type\s+/, "")
            .split(" as ")[0]
            ?.trim(),
        )
        .filter((name): name is string => Boolean(name)),
    }
  })
  .filter(({ imported }) => imported.length > 0)

describe("stored page content stays block JSON", () => {
  it("finds the @wordpress/blocks imports it means to check", () => {
    expect(blocksPackageImports.length).toBeGreaterThan(0)
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
