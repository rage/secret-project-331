/**
 * Types for the in-browser test worker protocol.
 *
 * Worker runtime: public/browserTestWorker.js (classic worker, loads Pyodide via importScripts).
 *
 * Protocol:
 * - Input: { script: string } — full script to run (e.g. Python for Pyodide).
 * - Output: { runResult: RunResult } on success, or { error: string } on failure.
 * The worker runs the script, captures stdout, and parses the last line as JSON (RunResult).
 */

export type WorkerRequest = { script: string }
export type WorkerResponse = { runResult: import("@/tmc/cli").RunResult } | { error: string }
