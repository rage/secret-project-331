/**
 * Classic Web Worker: runs the inlined Python test script in Pyodide.
 * Loads Pyodide from CDN via importScripts, captures stdout, parses JSON RunResult, posts back.
 * Keep PYODIDE_CDN_VERSION in sync with util/pyodideConfig.ts PYODIDE_VERSION.
 */
/* global importScripts, loadPyodide */
var PYODIDE_CDN_VERSION = "0.29.3"
var INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_CDN_VERSION + "/full/"

importScripts(INDEX_URL + "pyodide.js")

var pyodidePromise = null

function getPyodide() {
  if (pyodidePromise !== null) {
    return pyodidePromise
  }
  pyodidePromise = loadPyodide({ indexURL: INDEX_URL })
  return pyodidePromise
}

self.onmessage = function (e) {
  var script = e.data.script
  getPyodide()
    .then(function (pyodide) {
      var stdout = ""
      pyodide.setStdout({
        batched: function (msg) {
          stdout += msg
        },
      })
      pyodide.setStderr({
        batched: function (msg) {
          stdout += msg
        },
      })
      return pyodide.runPythonAsync(script).then(function () {
        var lines = stdout.trim().split("\n")
        var lastLine = lines[lines.length - 1] ?? ""
        var runResult = JSON.parse(lastLine)
        self.postMessage({ runResult: runResult })
      })
    })
    .catch(function (err) {
      var message = err && err.message ? err.message : String(err)
      self.postMessage({ error: message })
    })
}
