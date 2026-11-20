import {
  extractCitationsFromText,
  findTermMatches,
  parseText,
} from "@/components/course-material/ContentRenderer/util/textParsing"

import cases from "../../headless-lms/mcp/src/engine/renderer_text_cases.json"

// The MCP glossary tool runs the same cases, so its usage reports follow what students see.
describe("renderer text cases shared with the MCP glossary tool", () => {
  test.each(cases.citations)("citations in $text", ({ text, keys }) => {
    expect(extractCitationsFromText(text).map((citation) => citation.citationKey)).toEqual(keys)
  })

  test.each(cases.terms)("$term in $text", ({ text, term, is_used }) => {
    expect(findTermMatches(text, term).length > 0).toBe(is_used)
  })

  test.each(cases.term_divergences)("$term in $text as rendered", ({ text, term, renderer }) => {
    const glossary = [
      {
        id: "term",
        course_id: "course",
        term,
        definition: "",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]
    expect(parseText(text, glossary).glossaryEntries.length > 0).toBe(renderer)
  })
})
