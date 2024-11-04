/* eslint-disable i18next/no-literal-string */

/*
 * Certain @wordpress packages include nested node_modules folders, and additional @wordpress
 * dependencies, which causes issues by loading multiple copies of @wordpress packages.
 *
 * Because some of these @wordpress dependencies use singletons, loading multiple copies can create
 * multiple instances of these singletons. To ensure all @wordpress imports resolve to a single top-level version,
 * this script recursively deletes all nested @wordpress directories under node_modules/@wordpress.
 */

import * as fs from "fs"
import * as path from "path"

const targetFolder: string = path.join(__dirname, "../node_modules/@wordpress")

/**
 * Recursively traverses directories to find and delete subdirectories named '@wordpress'.
 * @param dir - The directory to traverse.
 */
const deleteWordpressDirectories = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    console.warn(`Directory does not exist: ${dir}`)
    return
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === "@wordpress") {
        try {
          fs.rmSync(fullPath, { recursive: true, force: true })
        } catch (error) {
          console.error(`Failed to delete ${fullPath}:`, error)
        }
      } else {
        // Recursively traverse subdirectories
        deleteWordpressDirectories(fullPath)
      }
    }
  }
}

deleteWordpressDirectories(targetFolder)
console.log("Cleaned all nested @wordpress directories.")
