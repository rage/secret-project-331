import enMainFrontend from "@/shared-module/common/locales/en/main-frontend.json"
import fiMainFrontend from "@/shared-module/common/locales/fi/main-frontend.json"
import fiSharedModule from "@/shared-module/common/locales/fi/shared-module.json"

// Asserts on the locale files directly since the test i18n mock only echoes keys back.
describe("accessibility locale copy", () => {
  it("labels the search toggle button as search, not browse (issue #63)", () => {
    expect(fiMainFrontend["button-label-search-for-pages"]).toBe("Haku")
  })

  it("renames the Finnish breadcrumb nav to a plain 'you are here' phrasing (issue #61)", () => {
    expect(fiSharedModule["breadcrumb"]).toBe("Olet tässä:")
    expect(fiMainFrontend["aria-label-breadcrumb"]).toBe("Olet tässä:")
  })

  it("provides search result live-region keys in both languages (issue #63)", () => {
    for (const key of [
      "search-pages-live-region-one-result-found",
      "search-pages-live-region-many-results-found",
      "search-pages-live-region-no-results-found",
      "search-pages-live-region-search-failed",
      "search-pages-live-region-searching",
    ] as const) {
      expect(enMainFrontend[key]).toBeTruthy()
      expect(fiMainFrontend[key]).toBeTruthy()
    }
  })

  it("provides chatbot per-message labels in both languages (issue #56)", () => {
    expect(enMainFrontend["message-from-chatbot"]).toBeTruthy()
    expect(enMainFrontend["message-from-you"]).toBeTruthy()
    expect(fiMainFrontend["message-from-chatbot"]).toBeTruthy()
    expect(fiMainFrontend["message-from-you"]).toBeTruthy()
  })
})
