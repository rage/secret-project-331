import { describe, expect, it } from "vitest"

import { PRIVATE_SPEC_VALIDATION_ERRORS } from "@/util/stateInterfaces"

import en from "./en/example-exercise.json"
import fi from "./fi/example-exercise.json"

const LOCALES: Record<string, Record<string, string>> = { en, fi }

const params = (text: string) =>
  [...new Set([...text.matchAll(/{{(\w+)}}/g)].map((match) => match[1]))].toSorted()

describe("locales", () => {
  it.each(Object.entries(LOCALES))("%s has exactly the English keys", (_language, strings) => {
    expect(Object.keys(strings).toSorted()).toEqual(Object.keys(en).toSorted())
  })

  it.each(Object.entries(LOCALES))("%s names the English interpolation params", (_, strings) => {
    for (const [key, text] of Object.entries(en)) {
      expect(params(strings[key] ?? ""), key).toEqual(params(text))
    }
  })

  it("translate every code the views display", () => {
    for (const code of PRIVATE_SPEC_VALIDATION_ERRORS) {
      expect(Object.hasOwn(en, code), code).toBe(true)
    }
  })
})
