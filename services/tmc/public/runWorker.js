/**
 * Run worker: executes user Python code in Pyodide with interactive stdin.
 * When the program calls input(), the worker posts "stdin_request", waits for
 * the main thread to send "stdin_line" via postMessage, then returns that line
 * to Python. No SharedArrayBuffer required (works without cross-origin isolation).
 * Keep PYODIDE_CDN_VERSION in sync with util/pyodideConfig.ts PYODIDE_VERSION.
 */
/* global importScripts, loadPyodide */
var PYODIDE_CDN_VERSION = "0.29.3"
var INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_CDN_VERSION + "/full/"

importScripts(INDEX_URL + "pyodide.js")

var pyodidePromise = null
var pendingStdinResolve = null

function getPyodide() {
  if (pyodidePromise !== null) {
    return pyodidePromise
  }
  pyodidePromise = loadPyodide({ indexURL: INDEX_URL })
  return pyodidePromise
}

self.inputPromise = function () {
  self.postMessage({ type: "stdin_request" })
  return new Promise(function (resolve) {
    pendingStdinResolve = resolve
  })
}

self.printError = function (message, kind, line, tb) {
  var msg = kind + " on line " + line + ": " + message
  self.postMessage({ type: "run_error", message: msg, output: stdout })
  runHadError = true
}

var runHadError = false
var stdout = ""

self.exit = function () {
  if (!runHadError) {
    self.postMessage({ type: "run_done", output: stdout })
  }
}

self.onmessage = function (e) {
  var data = e.data

  if (data.type === "stdin_line") {
    if (pendingStdinResolve) {
      var line = data.line != null ? String(data.line) : ""
      if (line.length > 0 && line.charAt(line.length - 1) !== "\n") {
        line += "\n"
      }
      pendingStdinResolve(line)
      pendingStdinResolve = null
    }
    return
  }

  if (data.type !== "run") {
    return
  }

  var script = data.script
  runHadError = false
  stdout = ""

  getPyodide()
    .then(function (pyodide) {
      stdout = ""
      pyodide.setStdout({
        raw: function (byte) {
          var ch = String.fromCharCode(byte)
          stdout += ch
          self.postMessage({ type: "stdout", chunk: ch })
        },
      })
      pyodide.setStderr({
        raw: function (byte) {
          var ch = String.fromCharCode(byte)
          stdout += ch
          self.postMessage({ type: "stdout", chunk: ch })
        },
      })

      var code =
        "async def execute():\n" +
        ' __name__ = "__main__"\n' +
        script
          .replace(/\\/g, "\\\\")
          .replace(/"""/g, '\\"\\"\\"')
          .split("\n")
          .map(function (x) {
            return " " + x
          })
          .join("\n") +
        "\n pass\n\n" +
        "import asyncio, sys, traceback\n" +
        "from js import exit, inputPromise, printError\n\n" +
        "async def input(prompt=None):\n" +
        " if prompt:\n" +
        '  __builtins__.print(prompt, end="")\n' +
        " return await inputPromise()\n\n" +
        "async def wrap_execution():\n" +
        " try:\n" +
        "  await execute()\n" +
        "  exit()\n" +
        " except Exception:\n" +
        "  t, v, tb = sys.exc_info()\n" +
        "  frames = traceback.extract_tb(tb)\n" +
        '  tb2 = ["Line " + str(f.lineno - 2) + " in " + f.name + "()" for f in frames[2:]]\n' +
        "  printError(str(v), type(v).__name__, frames[-1].lineno - 2, tb2)\n" +
        "  exit()\n\n" +
        "asyncio.create_task(wrap_execution())\n"

      var escapedCode = code.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')

      var parsedCode =
        "import ast, re, sys, traceback\n" +
        "from js import exit, printError\n\n" +
        "class PatchCode(ast.NodeTransformer):\n" +
        " def generic_visit(self, node):\n" +
        "  super().generic_visit(node)\n" +
        "  if isinstance(node, ast.Constant) and isinstance(node.value, str):\n" +
        "   remove_padding = re.sub(r'[\\n] ', '\\n', node.value)\n" +
        "   result = ast.Constant(remove_padding)\n" +
        "   return ast.copy_location(result, node)\n" +
        "  input_conditions = (\n" +
        "   isinstance(node, ast.Call)\n" +
        "   and isinstance(node.func, ast.Name)\n" +
        "   and node.func.id == 'input'\n" +
        "  )\n" +
        "  if input_conditions:\n" +
        "   result = ast.Await(node)\n" +
        "   return ast.copy_location(result, node)\n" +
        "  return node\n\n" +
        "try:\n" +
        ' tree = ast.parse("""' +
        escapedCode +
        '""")\n' +
        " optimizer = PatchCode()\n" +
        " tree = optimizer.visit(tree)\n" +
        ' code = compile(tree, " ", "exec")\n' +
        " exec(code)\n" +
        "except Exception:\n" +
        " t, v, tb = sys.exc_info()\n" +
        " try:\n" +
        "  frames = traceback.extract_tb(tb)\n" +
        "  line = frames[-1].lineno - 2 if frames else 0\n" +
        " except Exception:\n" +
        "  line = 0\n" +
        " printError(str(v), type(v).__name__, line, [])\n" +
        " exit()\n"

      return pyodide.runPythonAsync(parsedCode)
    })
    .then(function () {
      /* run_done is posted by exit() when user code finishes */
    })
    .catch(function (err) {
      var message = err && err.message ? err.message : String(err)
      self.postMessage({ type: "run_error", message: message })
    })
}
