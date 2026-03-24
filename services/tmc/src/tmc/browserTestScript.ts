import * as fs from "node:fs/promises"
import path from "node:path"

import {
  escapeForTripleQuotedString,
  type FileEntry,
  readFilesByExtension,
} from "./browserTestScriptHelpers"

export type BuildBrowserTestScriptResult = { script: string } | { error: string }

/**
 * Builds the in-browser test script for Python (TMC + unittest) exercises.
 *
 * Contract:
 * - Input: template dir with test/ and tmc/ containing .py files.
 * - Output script expects __webeditor_user_code_b64 (base64-encoded user code) to be defined
 *   when run in Pyodide; it prints a single JSON line (RunResult) on the last line of stdout.
 * - For other languages, add a separate builder and call it from the public-spec route.
 *
 * Returns { script } on success or { error } when the template is missing test/tmc or patching fails.
 */
export async function buildBrowserTestScript(
  templateDir: string,
): Promise<BuildBrowserTestScriptResult> {
  const testDir = path.join(templateDir, "test")
  const tmcDir = path.join(templateDir, "tmc")
  try {
    await fs.access(testDir)
  } catch {
    return { error: `template missing test directory: ${testDir}` }
  }
  try {
    await fs.access(tmcDir)
  } catch {
    return { error: `template missing tmc directory: ${tmcDir}` }
  }
  const testFiles = await readFilesByExtension(testDir, ".py")
  const tmcFiles = await readFilesByExtension(tmcDir, ".py")
  if (testFiles.length === 0) {
    return { error: "template test/ has no .py files" }
  }
  if (tmcFiles.length === 0) {
    return { error: "template tmc/ has no .py files" }
  }
  try {
    const script = inlineAndPatchTestSources(testFiles, tmcFiles)
    return { script }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `building test script failed: ${message}` }
  }
}

function stringifyPythonCode(code: string): string {
  return `"""\n${escapeForTripleQuotedString(code)}\n"""`
}

function findFileByShortName(name: string, files: FileEntry[], defaultFile?: FileEntry): FileEntry {
  const file = files.find((f) => f.shortName === name)
  if (!file) {
    if (defaultFile) {
      return defaultFile
    }
    throw new Error(`Expected to find file "${name}"`)
  }
  return file
}

function findMainTestFile(testFiles: FileEntry[]): FileEntry {
  const testFile = testFiles.find((f) => f.shortName !== "__init__.py")
  if (!testFile) {
    throw new Error("Couldn't find test file")
  }
  return testFile
}

function getContentByShortName(name: string, fileSet: FileEntry[]): string {
  const f = fileSet.find((x) => x.shortName === name)
  if (!f) {
    throw new Error(`File not found: ${name}`)
  }
  return f.content
}

function resolveImports(start: FileEntry, files: FileEntry[]): string {
  return wrap(start.content, [start.shortName], files)
}

function wrap(source: string, presentlyImported: string[], files: FileEntry[]): string {
  const importAllPattern = /^import \.(\w+)[ \t]*$/
  const importSomePattern = /^from \.(\w+) import ([\w,\s]+)/
  const sourceLines = source.split("\n")
  const lines = sourceLines.map((line, num) => {
    const importAllMatch = line.match(importAllPattern)
    if (importAllMatch) {
      return replaceImportAll(importAllMatch[1], presentlyImported, files)
    }
    const importSomeMatch = line.match(importSomePattern)
    if (importSomeMatch) {
      return replaceImportSome(
        { pkg: importSomeMatch[1], names: importSomeMatch[2].split(",").map((s) => s.trim()) },
        num,
        presentlyImported,
        files,
      )
    }
    return line
  })
  return lines.join("\n")
}

function replaceImportAll(pkg: string, presentlyImported: string[], files: FileEntry[]): string {
  const sourceShortName = pkg + ".py"
  if (presentlyImported.includes(sourceShortName)) {
    throw new Error(
      `${sourceShortName} has already been imported. Mutually recursive imports are not allowed.`,
    )
  }
  const source = getContentByShortName(sourceShortName, files)
  const wrapped = wrap(source, presentlyImported.concat([sourceShortName]), files)
  return `\n${wrapped}\n`
}

function replaceImportSome(
  im: { pkg: string; names: string[] },
  lineNumber: number,
  presentlyImported: string[],
  files: FileEntry[],
): string {
  const sourceShortName = im.pkg + ".py"
  if (presentlyImported.includes(sourceShortName)) {
    throw new Error(
      `${sourceShortName} has already been imported. Mutually recursive imports are not allowed.`,
    )
  }
  const source = getContentByShortName(sourceShortName, files)
  const wrapped = wrap(source, presentlyImported.concat([sourceShortName]), files)
  const sourceLines = wrapped.split("\n").map((line) => "\t" + line)
  const names = im.names.join(", ")
  const functionName = `__wrap${lineNumber}`
  const head = `def ${functionName}():\n`
  const body = sourceLines.join("\n") + "\n"
  const ret = `\treturn ${names}\n`
  const tail = `${names} = ${functionName}()`
  return head + body + ret + tail
}

function removeRelativeTmcImports(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const m1 = line.match(/^import \.(\w+)/)
      if (m1) {
        return `import tmc_${m1[1]}`
      }
      const m2 = line.match(/^from \.(\w+) import ([\w,\s]+)/)
      if (m2) {
        return `from tmc_${m2[1]} import ${m2[2]}`
      }
      const m3 = line.match(/^from tmc\.(\w+) import ([\w,\s]+)/)
      if (m3) {
        return `from tmc_${m3[1]} import ${m3[2]}`
      }
      return line
    })
    .join("\n")
}

function countIndentationDepth(line: string): number {
  if (line.trim() === "") {
    return Number.MAX_SAFE_INTEGER
  }
  const match = line.match(/^\s*/)
  return match ? match[0].length : 0
}

function findBlockEnd(lines: string[], at: number): number {
  const startDepth = countIndentationDepth(lines[at])
  let end = at + 1
  while (end < lines.length && countIndentationDepth(lines[end]) > startDepth) {
    end++
  }
  return end
}

function replaceLines(
  lines: string[],
  fromIdx: number,
  toIdx: number,
  replaceWith: string[],
): string[] {
  return lines.slice(0, fromIdx).concat(replaceWith).concat(lines.slice(toIdx))
}

function patchTmcUtilsPy(source: string): string {
  let stdOutPointerFound = false
  let loadModuleFound = false
  let reloadModuleFound = false

  const defLoadModule = ` from types import ModuleType
 from tmc_webeditor import code
 mod = ModuleType("editorcontent")
 try:
   exec(code, mod.__dict__)
 except Exception as e:
   return AssertionError(e)
 return mod
`

  const defReloadModule = ` global _stdout_pointer
 if isinstance(module, AssertionError):
   raise module
 _stdout_pointer = len(sys.stdout.getvalue())
 return load_module("editorcontent")
`

  let lines = [
    "import inspect",
    "def getsource(module):",
    "  return code",
    "inspect.getsource = getsource",
  ].concat(source.split("\n"))
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith("_stdout_pointer")) {
      stdOutPointerFound = true
      i++
    } else if (line.startsWith("def load_module")) {
      loadModuleFound = true
      const blockEnd = findBlockEnd(lines, i)
      const newBlock = defLoadModule.split("\n")
      lines = replaceLines(lines, i + 1, blockEnd, newBlock)
      i += newBlock.length
    } else if (line.startsWith("def reload_module")) {
      reloadModuleFound = true
      const blockEnd = findBlockEnd(lines, i)
      const newBlock = defReloadModule.split("\n")
      lines = replaceLines(lines, i + 1, blockEnd, newBlock)
      i += newBlock.length
    } else {
      i++
    }
  }

  const missing: string[] = []
  if (!stdOutPointerFound) {
    missing.push("Expected to find global `_stdout_pointer` from tmc/utils.py.")
  }
  if (!loadModuleFound) {
    missing.push("Expected to find function `load_module` from tmc/utils.py.")
  }
  if (!reloadModuleFound) {
    missing.push("Expected to find function `reload_module` from tmc/utils.py.")
  }
  if (missing.length > 0) {
    throw new Error(missing.join(" "))
  }

  return lines.join("\n")
}

function patchTmcFile(file: FileEntry, tmcFiles: FileEntry[]): string {
  let content = removeRelativeTmcImports(file.content)
  if (file.shortName === "utils.py") {
    content = patchTmcUtilsPy(content)
  }
  return resolveImports({ ...file, content }, tmcFiles)
}

/** Remove the `if __name__ == "__main__":` block so it never runs (we run tests with TMCTestRunner instead). */
function stripMainGuard(lines: string[]): string[] {
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const m = lines[i].match(/^(\s*)if\s+__name__\s*==\s*['"]__main__['"]\s*:\s*$/)
    if (m) {
      const baseIndent = (m[1] ?? "").length
      i++
      while (i < lines.length) {
        const line = lines[i]
        const trimmed = line.trimStart()
        if (trimmed === "" || line.length - trimmed.length > baseIndent) {
          i++
        } else {
          break
        }
      }
      continue
    }
    out.push(lines[i])
    i++
  }
  return out
}

function patchTestSource(
  testFile: FileEntry,
  testClassName: string,
  testFiles: FileEntry[],
): string {
  const lines = testFile.content.split("\n")
  const patchedOne = lines
    .map((line) => {
      const importMatches = line.match(/^from tmc import ([\w,\s]+)/)
      if (importMatches) {
        return importMatches[1]
          .split(",")
          .map((pkg) => `from tmc_${pkg.trim()} import ${pkg.trim()}`)
          .join("\n")
      }
      const importMatches2 = line.match(/from tmc\.(\w+) import ([\w,\s]+)/)
      if (importMatches2) {
        return `from tmc_${importMatches2[1]} import ${importMatches2[2]}`
      }
      return line.replace(/\w+Test\(unittest\.TestCase\)/, `${testClassName}(unittest.TestCase)`)
    })
    .join("\n")
  const patched = stripMainGuard(patchedOne.split("\n")).join("\n")
  return resolveImports({ ...testFile, content: patched }, testFiles)
}

function inlineAndPatchTestSources(testFiles: FileEntry[], tmcFiles: FileEntry[]): string {
  const test = findMainTestFile(testFiles)
  const defaultHmac: FileEntry = {
    fullName: "",
    shortName: "hmac_writer.py",
    originalContent: "",
    content: "# old template",
  }
  const tmcHmacWriter = findFileByShortName("hmac_writer.py", tmcFiles, defaultHmac)
  const tmcPoints = findFileByShortName("points.py", tmcFiles)
  const tmcResult = findFileByShortName("result.py", tmcFiles)
  const tmcRunner = findFileByShortName("runner.py", tmcFiles)
  const tmcUtils = findFileByShortName("utils.py", tmcFiles)

  const testCode = `
import base64, contextlib, io, json, sys, unittest
from types import ModuleType

_stdout_pointer = 0

def __wrap_import(module_name, code):
  mod = ModuleType(module_name)
  sys.modules[module_name] = mod
  exec(code, mod.__dict__)

# Create tmc_webeditor with user code from client (base64); no exec() so Pyodide always has .code
_tmc_webeditor_mod = ModuleType("tmc_webeditor")
sys.modules["tmc_webeditor"] = _tmc_webeditor_mod
_tmc_webeditor_mod.code = base64.b64decode(__webeditor_user_code_b64).decode("utf-8")

__wrap_import("tmc_hmac_writer", ${stringifyPythonCode(patchTmcFile(tmcHmacWriter, tmcFiles))})
__wrap_import("tmc_points", ${stringifyPythonCode(patchTmcFile(tmcPoints, tmcFiles))})
__wrap_import("tmc_result", ${stringifyPythonCode(patchTmcFile(tmcResult, tmcFiles))})
__wrap_import("tmc_runner", ${stringifyPythonCode(patchTmcFile(tmcRunner, tmcFiles))})
__wrap_import("tmc_utils", ${stringifyPythonCode(patchTmcFile(tmcUtils, tmcFiles))})

${patchTestSource(test, "PythonEditorTest", testFiles)}

from tmc_runner import TMCTestRunner
from tmc_webeditor import code

import inspect
def getsource(module):
  return code
inspect.getsource = getsource

test_suite = unittest.TestLoader().loadTestsFromTestCase(PythonEditorTest)
with io.StringIO() as buf:
  with contextlib.redirect_stdout(buf):
    TMCTestRunner(stream=buf).run(test_suite)
  from tmc_result import results
  test_results = [{"name": r.get("name", "noTestName"), "successful": r.get("passed", False), "points": r.get("points", []), "message": r.get("message", ""), "exception": r.get("exception", [])} for r in results]
  status = "PASSED" if all(r.get("passed", False) for r in results) else "TESTS_FAILED"
  output = {"status": status, "testResults": test_results, "logs": {}}
  print(json.dumps(output, ensure_ascii=False))
`
  return testCode
}
