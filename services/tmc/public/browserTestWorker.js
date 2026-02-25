/**
 * Classic Web Worker: runs the inlined Python test script in Pyodide.
 * Loads Pyodide from CDN via importScripts, captures stdout, parses JSON RunResult, posts back.
 * PYODIDE_INDEX_URL is injected at build time from src/util/pyodide-version.json.
 */
/* global importScripts, loadPyodide */
var PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"

importScripts(PYODIDE_INDEX_URL + "pyodide.js")

var pyodidePromise = null

function getPyodide() {
  if (pyodidePromise !== null) {
    return pyodidePromise
  }
  pyodidePromise = loadPyodide({ indexURL: PYODIDE_INDEX_URL })
  return pyodidePromise
}

self.onmessage = function (e) {
  var script = e.data.script
  getPyodide()
    .then(function (pyodide) {
      var stdout = ""
      var stderr = ""
      pyodide.setStdout({
        batched: function (msg) {
          stdout += msg + "\n"
        },
      })
      pyodide.setStderr({
        batched: function (msg) {
          stderr += msg + "\n"
        },
      })
      return pyodide.runPythonAsync(script).then(function () {
        var lines = stdout.split("\n").filter(function (s) {
          return s.trim().length > 0
        })
        var lastLine = lines.length > 0 ? lines[lines.length - 1] : ""
        var runResult = JSON.parse(lastLine)
        self.postMessage({ runResult: runResult })
      })
    })
    .catch(function (err) {
      var message = err && err.message ? err.message : String(err)
      self.postMessage({ error: message })
    })
}
