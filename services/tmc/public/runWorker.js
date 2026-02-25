/**
 * Run worker: executes user Python code in Pyodide with interactive stdin.
 * When the program calls input(), the worker posts "stdin_request", waits for
 * the main thread to send "stdin_line" via postMessage, then returns that line
 * to Python. No SharedArrayBuffer required (works without cross-origin isolation).
 * PYODIDE_INDEX_URL is injected at build time from src/util/pyodide-version.json.
 */
/* global importScripts, loadPyodide */
var PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"

importScripts(PYODIDE_INDEX_URL + "pyodide.js")

var pyodidePromise = null
var pendingStdinResolve = null
var templatePromise = null

function base64EncodeUtf8(str) {
  var bytes = new TextEncoder().encode(str)
  var binary = ""
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function getTemplate() {
  if (templatePromise !== null) {
    return templatePromise
  }
  var templateUrl = new URL("runWorkerTemplate.py", self.location.href).href
  templatePromise = fetch(templateUrl)
    .then(function (r) {
      if (!r.ok) {
        templatePromise = null
        throw new Error("Template fetch failed: " + r.status + " " + r.statusText)
      }
      return r.text()
    })
    .catch(function (err) {
      templatePromise = null
      throw err
    })
  return templatePromise
}

function getPyodide() {
  if (pyodidePromise !== null) {
    return pyodidePromise
  }
  pyodidePromise = loadPyodide({ indexURL: PYODIDE_INDEX_URL }).catch(function (err) {
    pyodidePromise = null
    throw err
  })
  return pyodidePromise
}

self.inputPromise = function (prompt) {
  self.postMessage({
    type: "stdin_request",
    prompt: prompt != null ? String(prompt) : "",
  })
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
var stderr = ""

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
      stderr = ""
      var stdoutDecoder = new TextDecoder("utf-8", { fatal: false })
      var stderrDecoder = new TextDecoder("utf-8", { fatal: false })
      pyodide.setStdout({
        raw: function (byte) {
          var chunk = stdoutDecoder.decode(new Uint8Array([byte]), { stream: true })
          if (chunk.length > 0) {
            stdout += chunk
            self.postMessage({ type: "stdout", chunk: chunk })
          }
        },
      })
      pyodide.setStderr({
        raw: function (byte) {
          var chunk = stderrDecoder.decode(new Uint8Array([byte]), { stream: true })
          if (chunk.length > 0) {
            stderr += chunk
            self.postMessage({ type: "stderr", chunk: chunk })
          }
        },
      })

      self.userScriptB64 = base64EncodeUtf8(script)
      return getTemplate()
        .then(function (template) {
          return pyodide.runPythonAsync(template)
        })
        .then(function () {
          var flushOut = stdoutDecoder.decode(new Uint8Array(0), { stream: false })
          var flushErr = stderrDecoder.decode(new Uint8Array(0), { stream: false })
          if (flushOut.length > 0) {
            stdout += flushOut
            self.postMessage({ type: "stdout", chunk: flushOut })
          }
          if (flushErr.length > 0) {
            stderr += flushErr
            self.postMessage({ type: "stderr", chunk: flushErr })
          }
        })
    })
    .then(function () {
      /* run_done is posted by exit() when user code finishes */
    })
    .catch(function (err) {
      var message = err && err.message ? err.message : String(err)
      self.postMessage({ type: "run_error", message: message })
    })
}
