/**
 * @jest-environment node
 */

import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import {
  cleanNestedWordpressPackages,
  getWordpressDependencies,
} from "../../scripts/cleanWordpressModules"

const WORDPRESS_DEPENDENCIES = ["@wordpress/blocks", "@wordpress/block-library"]

let fixtureRoot: string

const absolute = (...segments: string[]): string => path.join(fixtureRoot, ...segments)

const writePackage = (...segments: string[]): string => {
  const packageDirectory = absolute(...segments)
  fs.mkdirSync(packageDirectory, { recursive: true })
  fs.writeFileSync(path.join(packageDirectory, "package.json"), "{}")
  return packageDirectory
}

const linkDirectory = (target: string, ...linkSegments: string[]): string => {
  const linkPath = absolute(...linkSegments)
  fs.mkdirSync(path.dirname(linkPath), { recursive: true })
  fs.symlinkSync(target, linkPath, "dir")
  return linkPath
}

/**
 * Builds a node_modules tree covering every shape the traversal has to tell apart: a hoisted nested
 * duplicate, pnpm's symlink farms and store, symlink cycles, and a nested tree whose real contents
 * live outside the root.
 */
const createFixture = () => {
  const root = absolute("node_modules", "@wordpress")

  // A hoisted-style package carrying a genuine nested duplicate, which is the whole point of this
  // script, next to a nested package we do not own and a store directory that must stay closed.
  writePackage("node_modules", "@wordpress", "hoisted-pkg")
  const nestedDuplicate = writePackage(
    "node_modules",
    "@wordpress",
    "hoisted-pkg",
    "node_modules",
    "@wordpress",
    "blocks",
  )
  const nestedForeignPackage = writePackage(
    "node_modules",
    "@wordpress",
    "hoisted-pkg",
    "node_modules",
    "@wordpress",
    "some-other-package",
  )
  const nestedStore = absolute("node_modules", "@wordpress", "hoisted-pkg", "node_modules", ".pnpm")
  const storeInsideNestedNodeModules = writePackage(
    "node_modules",
    "@wordpress",
    "hoisted-pkg",
    "node_modules",
    ".pnpm",
    "@wordpress+blocks@1.0.0",
    "node_modules",
    "@wordpress",
    "blocks",
  )

  // pnpm's layout: real packages live in the store, and both the top level and each package's own
  // dependency directory are farms of symlinks pointing at them.
  const storedBlocks = writePackage(
    "node_modules",
    ".pnpm",
    "@wordpress+blocks@1.0.0",
    "node_modules",
    "@wordpress",
    "blocks",
  )
  const storedBlockLibrary = writePackage(
    "node_modules",
    ".pnpm",
    "@wordpress+block-library@1.0.0",
    "node_modules",
    "@wordpress",
    "block-library",
  )
  const storeLinkFarmEntry = linkDirectory(
    storedBlocks,
    "node_modules",
    ".pnpm",
    "@wordpress+block-library@1.0.0",
    "node_modules",
    "@wordpress",
    "blocks",
  )
  const topLevelBlocksLink = linkDirectory(storedBlocks, "node_modules", "@wordpress", "blocks")
  const topLevelBlockLibraryLink = linkDirectory(
    storedBlockLibrary,
    "node_modules",
    "@wordpress",
    "block-library",
  )

  // A nested entry that is only a link to a package installed elsewhere.
  const externalBlocks = writePackage("external", "@wordpress", "blocks")
  const linkedNestedPackage = linkDirectory(
    externalBlocks,
    "node_modules",
    "@wordpress",
    "linking-pkg",
    "node_modules",
    "@wordpress",
    "blocks",
  )

  // A nested tree that looks like it is below the root but whose contents are not.
  const outsideBlocks = writePackage("outside", "node_modules", "@wordpress", "blocks")
  writePackage("node_modules", "@wordpress", "escaping-pkg")
  linkDirectory(
    absolute("outside", "node_modules"),
    "node_modules",
    "@wordpress",
    "escaping-pkg",
    "node_modules",
  )

  // Symlink cycles: one package pointing at itself, and a pair pointing at each other.
  const selfCyclePackage = writePackage("node_modules", "@wordpress", "self-cycle-pkg")
  linkDirectory(selfCyclePackage, "node_modules", "@wordpress", "self-cycle-pkg", "node_modules")
  const cycleA = writePackage("node_modules", "@wordpress", "cycle-a")
  const cycleB = writePackage("node_modules", "@wordpress", "cycle-b")
  linkDirectory(cycleB, "node_modules", "@wordpress", "cycle-a", "node_modules", "cycle-b")
  linkDirectory(cycleA, "node_modules", "@wordpress", "cycle-b", "node_modules", "cycle-a")

  return {
    root,
    nestedDuplicate,
    nestedForeignPackage,
    nestedStore,
    storeInsideNestedNodeModules,
    storedBlocks,
    storedBlockLibrary,
    storeLinkFarmEntry,
    topLevelBlocksLink,
    topLevelBlockLibraryLink,
    externalBlocks,
    linkedNestedPackage,
    outsideBlocks,
  }
}

const clean = (root: string, options: { dryRun?: boolean } = {}) => {
  return cleanNestedWordpressPackages({
    rootDirectory: root,
    wordpressDependencies: WORDPRESS_DEPENDENCIES,
    log: () => {},
    ...options,
  })
}

const skipReasonFor = (result: ReturnType<typeof clean>, target: string): string | undefined => {
  return result.skipped.find((skipped) => skipped.path === target)?.reason
}

describe("cleanNestedWordpressPackages", () => {
  beforeEach(() => {
    // Resolved because macOS hands out a symlinked temporary directory.
    fixtureRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "clean-wordpress-")))
  })

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
  })

  it("deletes a nested duplicate and nothing else", () => {
    const fixture = createFixture()

    const result = clean(fixture.root)

    expect(result.deleted).toEqual([fixture.nestedDuplicate])
    expect(fs.existsSync(fixture.nestedDuplicate)).toBe(false)
  })

  it("leaves the pnpm store and its symlink farms alone", () => {
    const fixture = createFixture()

    clean(fixture.root)

    expect(fs.existsSync(fixture.storedBlocks)).toBe(true)
    expect(fs.existsSync(fixture.storedBlockLibrary)).toBe(true)
    expect(fs.lstatSync(fixture.storeLinkFarmEntry).isSymbolicLink()).toBe(true)
    expect(fs.lstatSync(fixture.topLevelBlocksLink).isSymbolicLink()).toBe(true)
    expect(fs.lstatSync(fixture.topLevelBlockLibraryLink).isSymbolicLink()).toBe(true)
  })

  it("does not enter a pnpm store nested inside a package it traverses", () => {
    const fixture = createFixture()

    const result = clean(fixture.root)

    expect(fs.existsSync(fixture.storeInsideNestedNodeModules)).toBe(true)
    expect(result.deleted).not.toContain(fixture.storeInsideNestedNodeModules)
    expect(skipReasonFor(result, fixture.nestedStore)).toBe("is the pnpm store")
  })

  it("skips a top level package that resolves into the pnpm store", () => {
    const fixture = createFixture()

    const result = clean(fixture.root)

    expect(skipReasonFor(result, fixture.topLevelBlocksLink)).toBe("resolves into the pnpm store")
    expect(skipReasonFor(result, fixture.topLevelBlockLibraryLink)).toBe(
      "resolves into the pnpm store",
    )
  })

  it("never deletes a nested entry that is only a symlink", () => {
    const fixture = createFixture()

    const result = clean(fixture.root)

    expect(skipReasonFor(result, fixture.linkedNestedPackage)).toBe(
      "is a symlink, not a nested copy",
    )
    expect(fs.lstatSync(fixture.linkedNestedPackage).isSymbolicLink()).toBe(true)
    expect(fs.existsSync(fixture.externalBlocks)).toBe(true)
  })

  it("refuses to delete a nested package whose contents live outside the root", () => {
    const fixture = createFixture()

    const result = clean(fixture.root)

    const candidate = path.join(
      fixture.root,
      "escaping-pkg",
      "node_modules",
      "@wordpress",
      "blocks",
    )
    expect(skipReasonFor(result, candidate)).toBe(`is outside ${fixture.root}`)
    expect(fs.existsSync(fixture.outsideBlocks)).toBe(true)
  })

  it("keeps nested packages that are not listed as dependencies", () => {
    const fixture = createFixture()

    clean(fixture.root)

    expect(fs.existsSync(fixture.nestedForeignPackage)).toBe(true)
  })

  it("terminates on symlink cycles", () => {
    const fixture = createFixture()

    const result = clean(fixture.root)

    expect(result.deleted).toEqual([fixture.nestedDuplicate])
  })

  it("deletes nothing on a dry run", () => {
    const fixture = createFixture()

    const result = clean(fixture.root, { dryRun: true })

    expect(result.deleted).toEqual([fixture.nestedDuplicate])
    expect(fs.existsSync(fixture.nestedDuplicate)).toBe(true)
  })

  it("finds duplicates nested more than one level deep", () => {
    const root = absolute("node_modules", "@wordpress")
    writePackage("node_modules", "@wordpress", "outer")
    const deepDuplicate = writePackage(
      "node_modules",
      "@wordpress",
      "outer",
      "node_modules",
      "@wordpress",
      "some-other-package",
      "node_modules",
      "@wordpress",
      "blocks",
    )

    const result = clean(root)

    expect(result.deleted).toEqual([deepDuplicate])
  })

  it("reports a missing root instead of throwing", () => {
    const result = clean(absolute("node_modules", "@wordpress"))

    expect(result.deleted).toEqual([])
    expect(result.skipped).toEqual([
      { path: absolute("node_modules", "@wordpress"), reason: "does not exist" },
    ])
  })
})

describe("getWordpressDependencies", () => {
  beforeEach(() => {
    fixtureRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "clean-wordpress-")))
  })

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
  })

  it("collects @wordpress names from both dependency fields", () => {
    const packageJsonPath = absolute("package.json")
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify({
        dependencies: { "@wordpress/blocks": "1.0.0", react: "19.0.0" },
        devDependencies: { "@wordpress/scripts": "1.0.0" },
      }),
    )

    expect(getWordpressDependencies(packageJsonPath)).toEqual([
      "@wordpress/blocks",
      "@wordpress/scripts",
    ])
  })
})
