import type { ExerciseFile, PublicSpec } from "@/util/stateInterfaces"

/**
 * Orders paths component by component, as tmc-langs walks a project (`Path::cmp`), so that `src/a/b`
 * sorts before `src/a-b`. Compares UTF-16 code units, which matches byte order for ASCII names.
 */
export function comparePaths(a: string, b: string): number {
  const left = a.split("/")
  const right = b.split("/")
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const l = left[i] ?? ""
    const r = right[i] ?? ""
    if (l !== r) {
      return l < r ? -1 : 1
    }
  }
  return left.length - right.length
}

const PYTHON_NON_STUDENT_ROOTS = new Set(["test", "tmc", "venv", ".venv"])

/**
 * tmc-langs' python3 student file policy without `.tmcproject.yml` extras: sources outside the
 * project's test and tooling directories. Catches files the spec cannot name, such as ones a
 * student added in VS Code.
 */
function isPythonStudentSource(path: string): boolean {
  const components = path.split("/")
  return (
    /\.(py|ipynb)$/.test(path) &&
    !PYTHON_NON_STUDENT_ROOTS.has(components[0] ?? "") &&
    !components.includes(".ipynb_checkpoints")
  )
}

/** Whether `path` is one of `entries` or lies in a directory among them. */
export function isCoveredBy(path: string, entries: readonly string[]): boolean {
  return entries.some((entry) => path === entry || path.startsWith(`${entry}/`))
}

/** Whether a file of an exercise archive belongs to the student's answer. */
export function isStudentFile(path: string, publicSpec: PublicSpec): boolean {
  return isCoveredBy(path, publicSpec.student_file_paths) || isPythonStudentSource(path)
}

/**
 * The student files of an archive in the order the browser editor shows them: the spec's main file
 * first, then by path. Works for stubs, browser answers, VS Code answers and answers stored before
 * browser answers held only student files.
 */
export function studentFilesInEditorOrder(
  files: readonly ExerciseFile[],
  publicSpec: PublicSpec,
): ExerciseFile[] {
  const main = publicSpec.main_file
  return files
    .filter((file) => isStudentFile(file.filepath, publicSpec))
    .toSorted((a, b) => {
      if (a.filepath === main || b.filepath === main) {
        return a.filepath === main ? -1 : 1
      }
      return comparePaths(a.filepath, b.filepath)
    })
}
