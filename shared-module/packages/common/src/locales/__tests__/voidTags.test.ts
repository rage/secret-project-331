import fs from "fs"
import path from "path"

// A void tag cannot wrap text, so <Trans> renders `<link>text</link>` as an empty element.
const VOID_TAGS = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]
const VOID_TAG_PATTERN = new RegExp(`</(${VOID_TAGS.join("|")})\\s*>`, "i")

/** Keys whose values may contain void tags on purpose. */
const ALLOWED_KEYS: string[] = []

const localesDir = path.join(__dirname, "..")
const languages = fs
  .readdirSync(localesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "__tests__")
  .map((entry) => entry.name)

describe("locale files", () => {
  test("no translation value wraps text in an HTML void tag", () => {
    const offenders: string[] = []
    for (const language of languages) {
      const dir = path.join(localesDir, language)
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
        const json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as Record<
          string,
          unknown
        >
        for (const [key, value] of Object.entries(json)) {
          if (
            typeof value === "string" &&
            VOID_TAG_PATTERN.test(value) &&
            !ALLOWED_KEYS.includes(key)
          ) {
            offenders.push(`${language}/${file}: ${key}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
