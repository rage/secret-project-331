import fs from "fs"
import path from "path"

// jest runs these as ESM, so there is no __dirname to hang the paths off.
const CMS_ROOT = fs.existsSync(path.join(process.cwd(), "src/styles"))
  ? process.cwd()
  : path.join(process.cwd(), "services/cms")
const WORDPRESS_DIR = path.join(CMS_ROOT, "node_modules/@wordpress")
const PNPM_DIR = path.join(CMS_ROOT, "node_modules/.pnpm")

const EDITOR_STYLES_SCSS = "src/styles/Gutenberg/editor-styles.scss"

/** GutenbergEditor.tsx belongs to the editor components, but its inline css rots the same way. */
const OUR_STYLE_FILES = [
  EDITOR_STYLES_SCSS,
  "src/styles/Gutenberg/style.scss",
  "src/styles/EditorStyles.tsx",
  "src/styles/LocalStyles.tsx",
  "src/components/editors/GutenbergEditor.tsx",
]

/** Prefixes Gutenberg owns. Our own class names never start with one of these. */
const GUTENBERG_CLASS_NAME =
  /\.(block-editor-[\w-]+|components-[\w-]+|edit-post-[\w-]+|wp-block[\w-]*|editor-styles-wrapper|block-list-appender|alignwide|alignfull|is-root-container|is-selected)\b/g

/** A class Gutenberg no longer has, so the search below fails loudly if it stops finding anything. */
const CLASS_RENAMED_AWAY_UPSTREAM = "components-placeholder__learn-more"

const readFilesUnder = (directory: string, extension: string): string => {
  if (!fs.existsSync(directory)) {
    return ""
  }
  let contents = ""
  for (const entry of fs.readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(extension)) {
      continue
    }
    contents += fs.readFileSync(path.join(entry.parentPath, entry.name), "utf8")
  }
  return contents
}

const collectTargetedClassNames = (): string[] => {
  const classNames = new Set<string>()
  for (const file of OUR_STYLE_FILES) {
    const contents = fs.readFileSync(path.join(CMS_ROOT, file), "utf8")
    for (const match of contents.matchAll(GUTENBERG_CLASS_NAME)) {
      classNames.add(match[0].slice(1))
    }
  }
  return [...classNames].toSorted()
}

const readInstalled = (subdirectory: string, extension: string): string => {
  let contents = ""
  for (const packageName of fs.readdirSync(WORDPRESS_DIR)) {
    contents += readFilesUnder(path.join(WORDPRESS_DIR, packageName, subdirectory), extension)
  }
  return contents
}

// @wordpress/ui is not a direct dependency: block-library and friends pull it in, and it ships its
// css inside its js, so only the store copy carries the tokens it reads.
const uiModuleDirs = fs
  .readdirSync(PNPM_DIR)
  .filter((entry) => entry.startsWith("@wordpress+ui@"))
  .map((entry) => path.join(PNPM_DIR, entry, "node_modules/@wordpress/ui/build-module"))

const targetedClassNames = collectTargetedClassNames()
// Stylesheets carry the classes Gutenberg styles, the modules carry the ones it only emits in markup.
const installedStyles = readInstalled("build-style", ".css")
const installedModules = readInstalled("build-module", ".mjs")
const transitiveUiModules = uiModuleDirs.map((dir) => readFilesUnder(dir, ".mjs")).join("")

const isInstalled = (className: string) =>
  installedStyles.includes(className) || installedModules.includes(className)

const editorStylesScss = fs.readFileSync(path.join(CMS_ROOT, EDITOR_STYLES_SCSS), "utf8")
const captureAll = (pattern: RegExp): string[] =>
  [...editorStylesScss.matchAll(pattern)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  )
const declaredCustomProperties = captureAll(/^\s*(--[\w-]+):/gm)
const referencedCustomProperties = captureAll(/var\((--[\w-]+)/g)

describe("Gutenberg class names our styles override", () => {
  it("are picked up from every stylesheet we own", () => {
    expect(targetedClassNames.length).toBeGreaterThan(20)
  })

  it.each(targetedClassNames)(
    "%s still exists in the installed @wordpress packages",
    (className) => {
      expect(isInstalled(className)).toBe(true)
    },
  )

  it("reports a class Gutenberg has renamed away as missing", () => {
    expect(isInstalled(CLASS_RENAMED_AWAY_UPSTREAM)).toBe(false)
  })
})

describe("the wpds font tokens we set for Gutenberg", () => {
  it("can find the transitively installed @wordpress/ui, which reads them", () => {
    expect(uiModuleDirs.length).toBeGreaterThan(0)
    expect(transitiveUiModules.length).toBeGreaterThan(0)
  })

  it.each(declaredCustomProperties)("%s is read by a package we ship", (property) => {
    const isRead =
      installedStyles.includes(property) ||
      installedModules.includes(property) ||
      transitiveUiModules.includes(property)
    expect(isRead).toBe(true)
  })

  it.each(referencedCustomProperties)("%s is declared before our rules use it", (property) => {
    expect(declaredCustomProperties).toContain(property)
  })
})
