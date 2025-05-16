/*
 * Certain @wordpress packages include nested node_modules folders and additional @wordpress
 * dependencies, which causes issues by loading multiple copies of @wordpress packages.
 *
 * Because some of these @wordpress dependencies use singletons, loading multiple copies can create
 * multiple instances of these singletons. To ensure all @wordpress imports resolve to a single top-level version,
 * this script recursively deletes nested @wordpress directories that match the packages listed in package.json.
 */

import * as fs from "fs"
import * as path from "path"

/**
 * Reads and parses the package.json file to extract @wordpress dependencies.
 * @param packageJsonPath - The path to the package.json file.
 * @returns An array of @wordpress dependency names.
 */
const getWordpressDependencies = (packageJsonPath: string): string[] => {
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
    const wordpressDeps = allDependencies.filter((dep) => dep.startsWith("@wordpress/"))

    return wordpressDeps
  } catch (error) {
    console.error(`Error reading or parsing package.json:`, error)
    return []
  }
}

/**
 * Deletes a directory recursively if it exists.
 * @param dirPath - The path to the directory to delete.
 */
const deleteDirectory = (dirPath: string): void => {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true })
      console.log(`Deleted directory: ${dirPath}`)
    } catch (error) {
      console.error(`Failed to delete ${dirPath}:`, error)
    }
  } else {
    console.warn(`Directory does not exist: ${dirPath}`)
  }
}

/**
 * Traverses the directory tree to find and delete specified @wordpress packages.
 * @param currentDir - The current directory to traverse.
 * @param wordpressDependencies - The list of @wordpress dependencies to delete.
 */
const traverseAndDelete = (currentDir: string, wordpressDependencies: string[]): void => {
  if (!fs.existsSync(currentDir)) {
    console.warn(`Directory does not exist: ${currentDir}`)
    return
  }

  const entries: fs.Dirent[] = fs.readdirSync(currentDir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath: string = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === "@wordpress") {
        handleWordpressDirectory(entryPath, wordpressDependencies)
      } else {
        // Recursively traverse subdirectories
        traverseAndDelete(entryPath, wordpressDependencies)
      }
    }
  }
}

/**
 * Handles the deletion of specified @wordpress packages within a @wordpress directory.
 * @param wordpressDir - The path to the @wordpress directory.
 * @param wordpressDependencies - The list of @wordpress dependencies to delete.
 */
const handleWordpressDirectory = (wordpressDir: string, wordpressDependencies: string[]): void => {
  const wordpressEntries: fs.Dirent[] = fs.readdirSync(wordpressDir, { withFileTypes: true })

  for (const wpEntry of wordpressEntries) {
    if (wpEntry.isDirectory()) {
      const packageName = `@wordpress/${wpEntry.name}`
      if (wordpressDependencies.includes(packageName)) {
        const packagePath = path.join(wordpressDir, wpEntry.name)
        deleteDirectory(packagePath)
      }
    }
  }
}

/**
 * Initializes the cleanup process by reading dependencies and starting the traversal.
 */
const main = (): void => {
  const packageJsonPath: string = path.join(__dirname, "../package.json")
  const wordpressDependencies: string[] = getWordpressDependencies(packageJsonPath)

  if (wordpressDependencies.length === 0) {
    console.log("No @wordpress dependencies found to clean.")
    return
  }

  console.log("WordPress dependencies to clean:", wordpressDependencies)

  const targetFolder: string = path.join(__dirname, "../node_modules/@wordpress")
  traverseAndDelete(targetFolder, wordpressDependencies)

  console.log("Cleaned specified nested @wordpress directories.")
}

main()
