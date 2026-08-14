import fs from "fs"
import path from "path"

/**
 * Guards the `@wordpress` API surface the editor is built on.
 *
 * `src/wordpress-shims.d.ts` declares `@wordpress/block-editor` and `@wordpress/block-library` as
 * untyped modules, so every import from them is `any`: a symbol Gutenberg has dropped still
 * type-checks and only surfaces at runtime as an undefined component or a silently ignored prop.
 * These assertions read the installed packages instead of trusting the compiler.
 */

// jest runs these as ESM, so there is no __dirname to hang the paths off.
const CMS_ROOT = fs.existsSync(path.join(process.cwd(), "src/styles"))
  ? process.cwd()
  : path.join(process.cwd(), "services/cms")
const WORDPRESS_DIR = path.join(CMS_ROOT, "node_modules/@wordpress")

interface PackageApi {
  packageName: string
  /** Names our code imports from the package root. */
  namedExports: string[]
  /** Paths our code imports by subpath, relative to the package root. */
  files: string[]
}

/**
 * Everything our code names inside an installed `@wordpress` package, by package.
 *
 * The single source of truth for both suites below: an entry here is a promise that the upstream
 * package still provides the thing, so removing a usage from `src/` means removing it here too.
 */
export const WORDPRESS_PACKAGE_APIS: PackageApi[] = [
  {
    packageName: "base-styles",
    namedExports: [],
    files: [
      "_animations.scss",
      "_breakpoints.scss",
      "_colors.scss",
      "_mixins.scss",
      "_variables.scss",
      "_z-index.scss",
    ],
  },
  { packageName: "blob", namedExports: ["createBlobURL", "revokeBlobURL"], files: [] },
  {
    packageName: "block-editor",
    namedExports: [
      "BlockControls",
      "BlockEditorKeyboardShortcuts",
      "BlockEditorProvider",
      "BlockIcon",
      "BlockInspector",
      "BlockList",
      "BlockTools",
      "ButtonBlockAppender",
      "InnerBlocks",
      "InspectorControls",
      "MediaPlaceholder",
      "ObserveTyping",
      "RichText",
      "WritingFlow",
      "__experimentalLibrary",
      "__experimentalListView",
      "__unstableEditorStyles",
      "__unstableUseBlockSelectionClearer",
      "useBlockProps",
    ],
    files: ["build-style/content.css", "build-style/style.css"],
  },
  {
    packageName: "block-library",
    namedExports: ["__experimentalGetCoreBlocks", "registerCoreBlocks"],
    files: ["build-style/editor.css", "build-style/style.css", "build-style/theme.css"],
  },
  {
    packageName: "blocks",
    namedExports: [
      "createBlock",
      "createBlocksFromInnerBlocksTemplate",
      "getBlockType",
      "getBlockTypes",
      "getCategories",
      "registerBlockStyle",
      "registerBlockType",
      "registerBlockVariation",
      "serialize",
      "setCategories",
      "unregisterBlockStyle",
      "unregisterBlockVariation",
    ],
    files: [],
  },
  {
    packageName: "components",
    namedExports: [
      "Button",
      "ColorPalette",
      "Dropdown",
      "MenuGroup",
      "MenuItem",
      "Notice",
      "PanelBody",
      "Path",
      "Placeholder",
      "Popover",
      "SVG",
      "SelectControl",
      "SlotFillProvider",
      "TextControl",
      "ToolbarButton",
      "ToolbarDropdownMenu",
      "ToolbarGroup",
    ],
    files: ["build-style/style.css"],
  },
  {
    packageName: "compose",
    namedExports: ["createHigherOrderComponent", "useMergeRefs"],
    files: [],
  },
  { packageName: "data", namedExports: ["useDispatch", "useSelect"], files: [] },
  {
    packageName: "element",
    namedExports: ["Fragment", "useEffect", "useMemo", "useState"],
    files: [],
  },
  // build-style is missing from format-library's package exports, so GutenbergEditor reaches the
  // stylesheet through a relative node_modules path that breaks if the file moves.
  { packageName: "format-library", namedExports: [], files: ["build-style/style.css"] },
  { packageName: "hooks", namedExports: ["addFilter", "removeFilter"], files: [] },
  {
    packageName: "icons",
    namedExports: ["archive", "chevronRight", "code", "cover", "formatLTR"],
    files: [],
  },
  {
    packageName: "keyboard-shortcuts",
    namedExports: ["ShortcutProvider", "store", "useShortcut"],
    files: [],
  },
]

interface SourceContract {
  /** What our code does with these identifiers, so a failure says what broke. */
  usage: string
  packageName: string
  /** Files inside the installed package; an identifier may live in any of them. */
  files: string[]
  identifiers: string[]
}

/**
 * Prop names, settings keys, store names and filter hooks we pass to Gutenberg as plain strings.
 *
 * None of these are importable symbols, so they are checked by looking for the identifier in the
 * upstream source that consumes it.
 */
export const WORDPRESS_SOURCE_CONTRACTS: SourceContract[] = [
  {
    usage: "props GutenbergEditor passes to __experimentalListView",
    packageName: "block-editor",
    files: ["src/components/list-view/index.js"],
    identifiers: ["showBlockMovers", "isExpanded"],
  },
  {
    usage: "props GutenbergEditor passes to BlockTools and __unstableEditorStyles",
    packageName: "block-editor",
    files: ["src/components/block-tools/index.js", "src/components/editor-styles/index.js"],
    identifiers: ["__unstableContentRef", "scope", "transformOptions"],
  },
  {
    usage: "ignoredSelectors inside the editor style transformOptions",
    packageName: "block-editor",
    files: ["src/utils/transform-styles/types.ts"],
    identifiers: ["ignoredSelectors"],
  },
  {
    usage: "props GutenbergEditor passes to BlockEditorProvider",
    packageName: "block-editor",
    files: ["src/components/provider/index.js"],
    identifiers: ["settings", "value", "onInput", "onChange", "selection", "onChangeSelection"],
  },
  {
    usage: "keys in the settings object GutenbergEditor hands BlockEditorProvider",
    packageName: "block-editor",
    files: [
      "src/components/provider/index.js",
      "src/store/defaults.js",
      "src/store/get-block-settings.js",
    ],
    identifiers: [
      "allowedBlockTypes",
      "codeEditingEnabled",
      "disableCustomColors",
      "disableCustomFontSizes",
      "mediaUpload",
      "styles",
    ],
  },
  {
    usage: "core/block-editor selectors the editor.BlockEdit filters read",
    packageName: "block-editor",
    files: ["src/store/selectors.js"],
    identifiers: ["getBlock", "getBlocksByName", "getSettings"],
  },
  {
    usage: "isPreviewMode, the only route to telling a block preview from the document",
    packageName: "block-editor",
    files: ["src/store/defaults.js"],
    identifiers: ["isPreviewMode"],
  },
  {
    usage: "the block editor store name our useSelect calls resolve",
    packageName: "block-editor",
    files: ["src/store/constants.js"],
    identifiers: ["core/block-editor"],
  },
  {
    usage: "the editor.BlockEdit filter every one of our block HOCs hangs off",
    packageName: "block-editor",
    files: ["src/components/block-edit/edit.js"],
    identifiers: ["editor.BlockEdit"],
  },
  {
    usage: "the blocks.registerBlockType filter our attribute overrides hang off",
    packageName: "blocks",
    files: ["src/store/process-block-type.ts"],
    identifiers: ["blocks.registerBlockType"],
  },
  {
    usage: "the shortcut store name and action useCommonKeyboardShortCuts dispatches",
    packageName: "keyboard-shortcuts",
    files: ["src/store/index.ts", "src/store/actions.ts"],
    identifiers: ["core/keyboard-shortcuts", "registerShortcut", "keyCombination", "aliases"],
  },
  {
    usage: "the BlockControls group withParagraphAiToolbarAction fills",
    packageName: "block-editor",
    files: ["src/components/block-controls/groups.js"],
    identifiers: ["BlockControlsBlock"],
  },
]

/** Packages `src/wordpress-shims.d.ts` hand-declares because they ship no type entry point. */
const SHIMMED_PACKAGES = ["block-editor", "block-library"]

/** ListView props Gutenberg dropped in 2022, kept as proof the prop check can still fail. */
const LIST_VIEW_PROPS_REMOVED_UPSTREAM = [
  "showNestedBlocks",
  "__experimentalPersistentListViewFeatures",
  "__experimentalHideContainerBlockActions",
]

const packageFile = (packageName: string, relativePath: string) =>
  path.join(WORDPRESS_DIR, packageName, relativePath)

/**
 * Resolves an `export ... from` specifier the way a bundler would, so the walk survives the
 * extensionless and directory forms Gutenberg's builds occasionally emit.
 */
const resolveModule = (fromFile: string, specifier: string): string | undefined => {
  const base = path.resolve(path.dirname(fromFile), specifier)
  return [base, `${base}.mjs`, path.join(base, "index.mjs")].find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  )
}

/** Collects the names a built ESM entry point exports, following `export * from` re-exports. */
const collectExports = (entryPoint: string, visited = new Set<string>()): Set<string> => {
  const names = new Set<string>()
  const resolved = fs.realpathSync(entryPoint)
  if (visited.has(resolved)) {
    return names
  }
  visited.add(resolved)

  const source = fs.readFileSync(resolved, "utf8")

  for (const match of source.matchAll(/export\s*\*\s*from\s*"([^"]+)"/g)) {
    const target = match[1] === undefined ? undefined : resolveModule(resolved, match[1])
    if (target !== undefined) {
      for (const name of collectExports(target, visited)) {
        names.add(name)
      }
    }
  }

  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const clause of (match[1] ?? "").split(",")) {
      const exported = clause
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (exported !== undefined && exported !== "") {
        names.add(exported)
      }
    }
  }

  for (const match of source.matchAll(
    /export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    if (match[1] !== undefined) {
      names.add(match[1])
    }
  }

  return names
}

const exportsByPackage = new Map<string, Set<string>>(
  WORDPRESS_PACKAGE_APIS.filter((api) => api.namedExports.length > 0).map((api) => [
    api.packageName,
    collectExports(packageFile(api.packageName, "build-module/index.mjs")),
  ]),
)

const namedExportCases = WORDPRESS_PACKAGE_APIS.flatMap((api) =>
  api.namedExports.map((name) => [api.packageName, name] as const),
)
const fileCases = WORDPRESS_PACKAGE_APIS.flatMap((api) =>
  api.files.map((file) => [api.packageName, file] as const),
)
const contractCases = WORDPRESS_SOURCE_CONTRACTS.flatMap((contract) =>
  contract.identifiers.map((identifier) => ({ contract, identifier })),
)

describe("@wordpress symbols our code imports", () => {
  it.each(namedExportCases)("@wordpress/%s exports %s", (packageName, name) => {
    expect([...(exportsByPackage.get(packageName) ?? [])]).toContain(name)
  })
})

describe("@wordpress subpaths our code imports", () => {
  it.each(fileCases)("@wordpress/%s ships %s", (packageName, file) => {
    expect(fs.existsSync(packageFile(packageName, file))).toBe(true)
  })
})

describe("@wordpress identifiers our code passes as strings", () => {
  it.each(contractCases)(
    "$contract.usage still include $identifier",
    ({ contract, identifier }) => {
      const present = contract.files.filter((file) =>
        fs.existsSync(packageFile(contract.packageName, file)),
      )
      // A moved file cannot prove the identifier is gone, so say which path to go re-read.
      expect(present).not.toHaveLength(0)

      const sources = present
        .map((file) => fs.readFileSync(packageFile(contract.packageName, file), "utf8"))
        .join("")
      expect(sources).toContain(identifier)
    },
  )

  it.each(LIST_VIEW_PROPS_REMOVED_UPSTREAM)("reports %s as gone from ListView", (propName) => {
    const source = fs.readFileSync(
      packageFile("block-editor", "src/components/list-view/index.js"),
      "utf8",
    )
    expect(source).not.toContain(propName)
  })
})

describe("the hand-written declarations in src/wordpress-shims.d.ts", () => {
  const shims = fs.readFileSync(path.join(CMS_ROOT, "src/wordpress-shims.d.ts"), "utf8")

  it.each(SHIMMED_PACKAGES)("declare exactly the @wordpress/%s names checked here", (name) => {
    const block = shims.split(`declare module "@wordpress/${name}"`)[1]?.split("}")[0] ?? ""
    const declared = [...block.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)/g)].map(
      (match) => match[1],
    )
    const checked = WORDPRESS_PACKAGE_APIS.find((api) => api.packageName === name)?.namedExports

    expect(declared.toSorted()).toEqual(checked?.toSorted())
  })
})
