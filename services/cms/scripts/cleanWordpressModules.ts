/*
 * Certain @wordpress packages include nested node_modules folders and additional @wordpress
 * dependencies, which causes issues by loading multiple copies of @wordpress packages.
 *
 * Because some of these @wordpress dependencies use singletons, loading multiple copies can create
 * multiple instances of these singletons. To ensure all @wordpress imports resolve to a single top-level version,
 * this script recursively deletes nested @wordpress directories that match the packages listed in package.json.
 *
 * It runs on every developer's postinstall and deletes recursively, so it is written to under-delete:
 * see cleanNestedWordpressPackages for the guards that keep it away from pnpm's own link farms.
 */

import * as fs from "fs"
import * as path from "path"

const NODE_MODULES_DIRECTORY = "node_modules"
const PNPM_STORE_DIRECTORY = ".pnpm"
const WORDPRESS_SCOPE = "@wordpress"

export interface SkippedPath {
  path: string
  reason: string
}

export interface CleanNestedWordpressPackagesResult {
  deleted: string[]
  skipped: SkippedPath[]
}

export interface CleanNestedWordpressPackagesOptions {
  /** The `@wordpress` scope directory to search, and the boundary no deletion may leave. */
  rootDirectory: string
  /** Package names such as `@wordpress/blocks` that count as duplicates when found nested. */
  wordpressDependencies: string[]
  /** Report what would be deleted without touching the filesystem. */
  dryRun?: boolean | undefined
  /** Also log every path that was skipped and why. */
  verbose?: boolean | undefined
  log?: ((message: string) => void) | undefined
}

/**
 * Reads and parses the package.json file to extract @wordpress dependencies.
 * @param packageJsonPath - The path to the package.json file.
 * @returns An array of @wordpress dependency names.
 */
export const getWordpressDependencies = (packageJsonPath: string): string[] => {
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`package.json not found at ${packageJsonPath}`)
    return []
  }

  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8")
    const packageJson: {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    } = JSON.parse(packageJsonContent)

    const dependencies = Object.keys(packageJson.dependencies || {})
    const devDependencies = Object.keys(packageJson.devDependencies || {})

    const allDependencies = [...dependencies, ...devDependencies]
    const wordpressDeps = allDependencies.filter((dep) => dep.startsWith(`${WORDPRESS_SCOPE}/`))

    return wordpressDeps
  } catch (error) {
    console.error(`Error reading or parsing package.json:`, error)
    return []
  }
}

const resolveRealPath = (target: string): string | null => {
  try {
    return fs.realpathSync(target)
  } catch {
    return null
  }
}

const containsSegment = (target: string, segment: string): boolean => {
  return target.split(path.sep).includes(segment)
}

/** Whether `target` is `parent` itself or lives below it. */
const isAtOrBelow = (parent: string, target: string): boolean => {
  const relative = path.relative(parent, target)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

/**
 * Deletes nested duplicate copies of `wordpressDependencies` found under `rootDirectory`.
 *
 * Follows symlinks, because pnpm links every package rather than nesting it, and that is what makes
 * over-deletion the real hazard here: pnpm's `.pnpm/<pkg>/node_modules/@wordpress/` directories are
 * farms of symlinks to legitimately installed packages, and a recursive delete inside one ruins the
 * install. So a path is only deleted when it is a real directory (never a symlink), sits below
 * `rootDirectory` both by path and after resolution, and is nowhere near the pnpm store. Anything
 * that fails a check is reported in `skipped` instead.
 */
export const cleanNestedWordpressPackages = ({
  rootDirectory,
  wordpressDependencies,
  dryRun = false,
  verbose = false,
  log = console.log,
}: CleanNestedWordpressPackagesOptions): CleanNestedWordpressPackagesResult => {
  const root = path.resolve(rootDirectory)
  const duplicatePackageNames = new Set(wordpressDependencies)
  const result: CleanNestedWordpressPackagesResult = { deleted: [], skipped: [] }
  const visitedRealPaths = new Set<string>()

  const skip = (target: string, reason: string): void => {
    result.skipped.push({ path: target, reason })
    if (verbose) {
      log(`Skipped ${target}: ${reason}`)
    }
  }

  // Resolved separately because the root itself can sit behind a symlink, as it does under
  // macOS's /var: comparing a resolved candidate against an unresolved root rejects every match.
  const realRoot = resolveRealPath(root)
  if (realRoot === null) {
    skip(root, "does not exist")
    return result
  }

  /** Resolves a directory and claims it, or reports why it must not be traversed. */
  const enterDirectory = (directory: string): string | null => {
    const realDirectory = resolveRealPath(directory)
    if (realDirectory === null) {
      skip(directory, "could not be resolved")
      return null
    }

    if (containsSegment(realDirectory, PNPM_STORE_DIRECTORY)) {
      skip(directory, "resolves into the pnpm store")
      return null
    }

    if (visitedRealPaths.has(realDirectory)) {
      return null
    }
    visitedRealPaths.add(realDirectory)

    return realDirectory
  }

  const readSubdirectories = (directory: string): string[] => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch (error) {
      skip(directory, `could not be read: ${String(error)}`)
      return []
    }

    return entries
      .map((entry) => path.join(directory, entry.name))
      .filter((entryPath) => {
        if (path.basename(entryPath) === PNPM_STORE_DIRECTORY) {
          skip(entryPath, "is the pnpm store")
          return false
        }

        // statSync rather than the dirent, so pnpm's package symlinks count as directories.
        try {
          return fs.statSync(entryPath).isDirectory()
        } catch {
          return false
        }
      })
  }

  const remove = (candidate: string): void => {
    let isSymbolicLink: boolean
    try {
      isSymbolicLink = fs.lstatSync(candidate).isSymbolicLink()
    } catch (error) {
      skip(candidate, `could not be inspected: ${String(error)}`)
      return
    }

    if (isSymbolicLink) {
      skip(candidate, "is a symlink, not a nested copy")
      return
    }

    const realCandidate = resolveRealPath(candidate)
    if (realCandidate === null) {
      skip(candidate, "could not be resolved")
      return
    }

    if (
      candidate === root ||
      !isAtOrBelow(root, candidate) ||
      !isAtOrBelow(realRoot, realCandidate)
    ) {
      skip(candidate, `is outside ${root}`)
      return
    }

    if (dryRun) {
      result.deleted.push(candidate)
      log(`Would delete directory: ${candidate}`)
      return
    }

    try {
      fs.rmSync(candidate, { recursive: true, force: true })
      result.deleted.push(candidate)
      log(`Deleted directory: ${candidate}`)
    } catch (error) {
      skip(candidate, `could not be deleted: ${String(error)}`)
    }
  }

  const visitDirectory = (directory: string): void => {
    if (enterDirectory(directory) === null) {
      return
    }

    for (const entryPath of readSubdirectories(directory)) {
      if (path.basename(entryPath) === WORDPRESS_SCOPE) {
        cleanScopeDirectory(entryPath)
      } else {
        visitDirectory(entryPath)
      }
    }
  }

  const cleanScopeDirectory = (scopeDirectory: string): void => {
    if (enterDirectory(scopeDirectory) === null) {
      return
    }

    for (const entryPath of readSubdirectories(scopeDirectory)) {
      if (duplicatePackageNames.has(`${WORDPRESS_SCOPE}/${path.basename(entryPath)}`)) {
        remove(entryPath)
      } else {
        visitDirectory(entryPath)
      }
    }
  }

  // Starts below the root, so the top-level packages themselves are never deletion candidates.
  visitDirectory(root)

  return result
}

/**
 * Initializes the cleanup process by reading dependencies and starting the traversal.
 */
export const main = (argv: string[] = process.argv.slice(2)): void => {
  const dryRun = argv.includes("--dry-run")
  const verbose = argv.includes("--verbose") || dryRun

  const packageJsonPath: string = path.join(__dirname, "../package.json")
  const wordpressDependencies: string[] = getWordpressDependencies(packageJsonPath)

  if (wordpressDependencies.length === 0) {
    console.log("No @wordpress dependencies found to clean.")
    return
  }

  console.log("WordPress dependencies to clean:", wordpressDependencies)

  const { deleted, skipped } = cleanNestedWordpressPackages({
    rootDirectory: path.join(__dirname, `../${NODE_MODULES_DIRECTORY}/${WORDPRESS_SCOPE}`),
    wordpressDependencies,
    dryRun,
    verbose,
  })

  console.log(
    `Cleaned ${deleted.length} nested @wordpress ${deleted.length === 1 ? "directory" : "directories"}, left ${skipped.length} path(s) alone. Pass --verbose to see why.`,
  )
}

// ts-node runs this as the entry point; importing it from a test must not start deleting things.
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  main()
}
