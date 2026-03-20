/**
 * Classic Web Worker: runs the inlined Python test script in Pyodide.
 * Loads Pyodide via importScripts from our configured public URLs, captures stdout,
 * parses JSON RunResult, and posts back.
 * PYODIDE_INDEX_URL is injected at build time from src/util/pyodide-version.json.
 */
/* global importScripts, loadPyodide */
var PYODIDE_INDEX_URL = "/pyodide/v0.29.3/full/"

importScripts(PYODIDE_INDEX_URL + "pyodide.js")

var pyodidePromise = null

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

self.onmessage = function (e) {
  var script = e.data.script
  getPyodide()
    .then(function (pyodide) {
      var stdout = ""
      var stderrBuffer = []
      pyodide.setStdout({
        batched: function (msg) {
          stdout += msg + "\n"
        },
      })
      pyodide.setStderr({
        batched: function (msg) {
          stderrBuffer.push(msg)
        },
      })
      return pyodide.runPythonAsync(script).then(function () {
        var lines = stdout.split("\n").filter(function (s) {
          return s.trim().length > 0
        })
        var lastLine = lines.length > 0 ? lines[lines.length - 1] : ""
        var runResult = JSON.parse(lastLine)
        if (stderrBuffer.length > 0) {
          runResult.stderr = stderrBuffer.join("\n")
        }
        self.postMessage({ runResult: runResult })
      })
    })
    .catch(function (err) {
      var message = err && err.message ? err.message : String(err)
      self.postMessage({ error: message })
    })
}
