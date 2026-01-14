import {
  buildCourseUrl,
  buildLanguageSwitchedUrl,
  isValidCourseUrl,
  parseCourseUrl,
} from "../urlBuilder"

describe("urlBuilder", () => {
  describe("parseCourseUrl", () => {
    it("should parse a valid course URL correctly", () => {
      const url = "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: "uh-cs",
        courseSlug: "johdatus-kaikkeen",
        pagePath: "/",
      })
    })

    it("should parse URL with additional page path segments", () => {
      const url = "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/chapter-1/section1"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: "uh-cs",
        courseSlug: "johdatus-kaikkeen",
        pagePath: "/chapter-1/section1",
      })
    })

    it("should handle URL with no page path", () => {
      const url = "http://project-331.local/org/uh-cs/courses/empty"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: "uh-cs",
        courseSlug: "empty",
        pagePath: "/",
      })
    })

    it("should handle URL with trailing slash", () => {
      const url = "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: "uh-cs",
        courseSlug: "johdatus-kaikkeen",
        pagePath: "/",
      })
    })

    it("should handle URL with query parameters", () => {
      const url =
        "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/chapter-1?param=value"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: "uh-cs",
        courseSlug: "johdatus-kaikkeen",
        pagePath: "/chapter-1",
      })
    })

    it("should handle URL with hash fragment", () => {
      const url = "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/chapter-1#section"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: "uh-cs",
        courseSlug: "johdatus-kaikkeen",
        pagePath: "/chapter-1",
      })
    })

    it("should return null values for URLs missing 'org' segment", () => {
      const url = "http://project-331.local/uh-cs/courses/johdatus-kaikkeen"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: null,
        courseSlug: null,
        pagePath: null,
      })
    })

    it("should return null values for URLs missing 'courses' segment", () => {
      const url = "http://project-331.local/org/uh-cs/johdatus-kaikkeen"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: null,
        courseSlug: null,
        pagePath: null,
      })
    })

    it("should return null values for URLs with insufficient segments", () => {
      const url = "http://project-331.local/org/uh-cs"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: null,
        courseSlug: null,
        pagePath: null,
      })
    })

    it("should return null values for completely invalid URLs", () => {
      const url = "http://project-331.local/invalid"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: null,
        courseSlug: null,
        pagePath: null,
      })
    })

    it("should handle malformed URLs gracefully", () => {
      const url = "not-a-url"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: null,
        courseSlug: null,
        pagePath: null,
      })
    })

    it("should handle empty URL", () => {
      const url = ""
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: null,
        courseSlug: null,
        pagePath: null,
      })
    })
  })

  describe("isValidCourseUrl", () => {
    it("should return true for valid course URLs", () => {
      const url = "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen"
      expect(isValidCourseUrl(url)).toBe(true)
    })

    it("should return true for valid course URLs with page path", () => {
      const url = "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/chapter-1"
      expect(isValidCourseUrl(url)).toBe(true)
    })

    it("should return false for URLs missing 'org' segment", () => {
      const url = "http://project-331.local/uh-cs/courses/johdatus-kaikkeen"
      expect(isValidCourseUrl(url)).toBe(false)
    })

    it("should return false for URLs missing 'courses' segment", () => {
      const url = "http://project-331.local/org/uh-cs/johdatus-kaikkeen"
      expect(isValidCourseUrl(url)).toBe(false)
    })

    it("should return false for invalid URLs", () => {
      const url = "http://project-331.local/invalid"
      expect(isValidCourseUrl(url)).toBe(false)
    })

    it("should return false for malformed URLs", () => {
      const url = "not-a-url"
      expect(isValidCourseUrl(url)).toBe(false)
    })
  })

  describe("buildCourseUrl", () => {
    it("should build a complete course URL", () => {
      const result = buildCourseUrl({
        origin: "http://project-331.local",
        organizationSlug: "uh-cs",
        courseSlug: "johdatus-kaikkeen",
        pagePath: "/",
      })

      expect(result).toBe("http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/")
    })

    it("should build a course URL with page path", () => {
      const result = buildCourseUrl({
        origin: "http://project-331.local",
        organizationSlug: "uh-cs",
        courseSlug: "johdatus-kaikkeen",
        pagePath: "/chapter-1/section-1",
      })

      expect(result).toBe(
        "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/chapter-1/section-1",
      )
    })

    it("should handle page path without leading slash", () => {
      const result = buildCourseUrl({
        origin: "http://project-331.local",
        organizationSlug: "uh-cs",
        courseSlug: "johdatus-kaikkeen",
        pagePath: "chapter-1",
      })

      expect(result).toBe("http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/chapter-1")
    })

    it("should handle page path with leading slash", () => {
      const result = buildCourseUrl({
        origin: "http://project-331.local",
        organizationSlug: "uh-cs",
        courseSlug: "johdatus-kaikkeen",
        pagePath: "/chapter-1",
      })

      expect(result).toBe("http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/chapter-1")
    })

    it("should handle empty page path", () => {
      const result = buildCourseUrl({
        origin: "http://project-331.local",
        organizationSlug: "uh-cs",
        courseSlug: "johdatus-kaikkeen",
        pagePath: "",
      })

      expect(result).toBe("http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/")
    })
  })

  describe("buildLanguageSwitchedUrl", () => {
    it("should build a language-switched URL correctly", () => {
      const currentUrl = "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen"
      const newCourseSlug = "introduction-to-everything"
      const newPagePath = "/chapter-1/section-2"

      const result = buildLanguageSwitchedUrl(currentUrl, newCourseSlug, newPagePath)

      expect(result).toBe(
        "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/section-2",
      )
    })

    it("should build a language-switched URL with root page path", () => {
      const currentUrl = "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/chapter-1"
      const newCourseSlug = "introduction-to-everything"
      const newPagePath = "/"

      const result = buildLanguageSwitchedUrl(currentUrl, newCourseSlug, newPagePath)

      expect(result).toBe("http://project-331.local/org/uh-cs/courses/introduction-to-everything/")
    })

    it("should build a language-switched URL without page path", () => {
      const currentUrl = "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen"
      const newCourseSlug = "introduction-to-everything"
      const newPagePath = ""

      const result = buildLanguageSwitchedUrl(currentUrl, newCourseSlug, newPagePath)

      expect(result).toBe("http://project-331.local/org/uh-cs/courses/introduction-to-everything/")
    })

    it("should throw error for URLs missing 'org' segment", () => {
      const currentUrl = "http://project-331.local/uh-cs/courses/johdatus-kaikkeen"
      const newCourseSlug = "introduction-to-everything"
      const newPagePath = "/chapter-1"

      expect(() => {
        buildLanguageSwitchedUrl(currentUrl, newCourseSlug, newPagePath)
      }).toThrow("Invalid course URL structure")
    })

    it("should throw error for URLs missing 'courses' segment", () => {
      const currentUrl = "http://project-331.local/org/uh-cs/johdatus-kaikkeen"
      const newCourseSlug = "introduction-to-everything"
      const newPagePath = "/chapter-1"

      expect(() => {
        buildLanguageSwitchedUrl(currentUrl, newCourseSlug, newPagePath)
      }).toThrow("Invalid course URL structure")
    })

    it("should throw error for completely invalid URLs", () => {
      const currentUrl = "http://project-331.local/invalid"
      const newCourseSlug = "introduction-to-everything"
      const newPagePath = "/chapter-1"

      expect(() => {
        buildLanguageSwitchedUrl(currentUrl, newCourseSlug, newPagePath)
      }).toThrow("Invalid course URL structure")
    })

    it("should throw error for malformed URLs", () => {
      const currentUrl = "not-a-url"
      const newCourseSlug = "introduction-to-everything"
      const newPagePath = "/chapter-1"

      expect(() => {
        buildLanguageSwitchedUrl(currentUrl, newCourseSlug, newPagePath)
      }).toThrow("Invalid course URL structure")
    })
  })
})
