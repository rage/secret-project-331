// Guards the one place this package tolerates duplication: the injectable arrow function exists both
// as the string HOST_EMULATOR_SOURCE (used by the Playwright wrapper) and as the file
// src/browser/hostEmulator.js (which playwright-cli `cat`s). They must stay identical.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { HOST_EMULATOR_SOURCE } from "../src/browser/hostEmulatorSource"

test("hostEmulator.js contains exactly the HOST_EMULATOR_SOURCE arrow function", () => {
  const js = readFileSync(join(__dirname, "../src/browser/hostEmulator.js"), "utf8")
  // The .js is the eslint-disable header + the identical arrow function.
  expect(js.trimEnd().endsWith(HOST_EMULATOR_SOURCE)).toBe(true)
})
