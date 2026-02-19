import * as fs from "node:fs/promises"
import path from "node:path"

/**
 * Generic helpers for building in-browser test scripts.
 * Used by the Python/TMC-specific builder in browserTestScript.ts.
 */

export interface FileEntry {
  fullName: string
  shortName: string
  originalContent: string
  content: string
}

/**
 * Reads all files in a directory with the given extension (e.g. ".py"),
 * sorted by short name.
 */
export async function readFilesByExtension(dir: string, extension: string): Promise<FileEntry[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: FileEntry[] = []
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(extension)) {
      continue
    }
    const fullPath = path.join(dir, e.name)
    const content = await fs.readFile(fullPath, "utf-8")
    files.push({
      fullName: fullPath,
      shortName: e.name,
      originalContent: content,
      content,
    })
  }
  return files.sort((a, b) => a.shortName.localeCompare(b.shortName))
}

/**
 * Escapes a string for embedding inside a Python triple-quoted string ("""...""").
 * Backslashes and """ are escaped so the result can be placed between """ delimiters.
 */
export function escapeForTripleQuotedString(code: string): string {
  return code.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')
}
