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
        organizationSlug: "org",
        courseType: "uh-cs",
        courseSlug: "courses",
        pagePath: "/johdatus-kaikkeen",
      })
    })

    it("should parse URL with additional page path segments", () => {
      const url = "http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen/chapter-1/section1"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: "org",
        courseType: "uh-cs",
        courseSlug: "courses",
        pagePath: "/johdatus-kaikkeen/chapter-1/section1",
      })
    })

    it("should handle URL with no page path", () => {
      const url = "http://project-331.local/org/uh-cs/courses/empty"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: "org",
        courseType: "uh-cs",
        courseSlug: "courses",
        pagePath: "/empty",
      })
    })

    it("should return null values for invalid URLs", () => {
      const url = "http://project-331.local/invalid"
      const result = parseCourseUrl(url)

      expect(result).toEqual({
        organizationSlug: null,
        courseType: null,
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

    it("should return false for invalid URLs", () => {
      const url = "http://project-331.local/invalid"
      expect(isValidCourseUrl(url)).toBe(false)
    })
  })

  describe("buildCourseUrl", () => {
    it("should build a complete course URL", () => {
      const result = buildCourseUrl({
        origin: "http://project-331.local",
        organizationSlug: "org",
        courseType: "uh-cs",
        courseSlug: "courses",
        pagePath: "johdatus-kaikkeen",
      })

      expect(result).toBe("http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen")
    })

    it("should handle page path with leading slash", () => {
      const result = buildCourseUrl({
        origin: "http://project-331.local",
        organizationSlug: "org",
        courseType: "uh-cs",
        courseSlug: "courses",
        pagePath: "/johdatus-kaikkeen",
      })

      expect(result).toBe("http://project-331.local/org/uh-cs/courses/johdatus-kaikkeen")
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

    it("should return error for invalid URLs", () => {
      const currentUrl = "http://project-331.local/invalid"
      const newCourseSlug = "introduction-to-everything"
      const newPagePath = "introduction-to-everything"

      expect(() => {
        buildLanguageSwitchedUrl(currentUrl, newCourseSlug, newPagePath)
      }).toThrow("Invalid course URL structure")
    })
  })
})
