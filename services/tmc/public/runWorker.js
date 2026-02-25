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
  templatePromise = fetch(templateUrl).then(function (r) {
    return r.text()
  })
  return templatePromise
}

function getPyodide() {
  if (pyodidePromise !== null) {
    return pyodidePromise
  }
  pyodidePromise = loadPyodide({ indexURL: INDEX_URL })
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
            stdout += chunk
            self.postMessage({ type: "stdout", chunk: chunk })
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
            stdout += flushErr
            self.postMessage({ type: "stdout", chunk: flushErr })
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
