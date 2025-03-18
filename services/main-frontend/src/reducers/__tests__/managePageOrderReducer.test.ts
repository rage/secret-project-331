/// <reference types="jest" />

import managePageOrderReducer, {
  managePageOrderInitialState,
  ManagePageOrderState,
} from "../managePageOrderReducer"

import { Chapter, Course, CourseStructure, Page } from "@/shared-module/common/bindings"

const createPage = (overrides: Partial<Page>): Page => ({
  id: "default-page-id",
  chapter_id: "default-chapter-id",
  course_id: null,
  exam_id: null,
  order_number: 1,
  url_path: "/default-path",
  title: "Default Page Title",
  hidden: false,
  content: [],
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2023-01-01T00:00:00Z",
  page_language_group_id: null,
  deleted_at: null,
  copied_from: null,
  ...overrides,
})

const createChapter = (overrides: Partial<Chapter>): Chapter => ({
  id: "default-chapter-id",
  name: "Default Chapter Title",
  chapter_number: 1,
  front_page_id: null,
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2023-01-01T00:00:00Z",
  color: null,
  course_id: "default-course-id",
  deleted_at: null,
  chapter_image_url: null,
  course_module_id: "default-course-module-id",
  opens_at: null,
  deadline: null,
  copied_from: null,
  ...overrides,
})

const createCourse = (overrides: Partial<Course>): Course => ({
  id: "default-course-id",
  name: "Default Course",
  slug: "default-course",
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2023-01-01T00:00:00Z",
  description: null,
  organization_id: "default-org-id",
  deleted_at: null,
  language_code: "en",
  copied_from: null,
  content_search_language: null,
  course_language_group_id: "default-language-group",
  is_draft: false,
  is_test_mode: false,
  is_unlisted: false,
  base_module_completion_requires_n_submodule_completions: 0,
  can_add_chatbot: false,
  is_joinable_by_code_only: false,
  join_code: null,
  ask_marketing_consent: false,
  flagged_answers_threshold: null,
  ...overrides,
})

describe("managePageOrderReducer", () => {
  const samplePage1 = createPage({
    id: "page1",
    chapter_id: "chapter1",
    order_number: 1,
    url_path: "/page1",
  })

  const samplePage2 = createPage({
    id: "page2",
    chapter_id: "chapter1",
    order_number: 2,
    url_path: "/page2",
  })

  const samplePage3 = createPage({
    id: "page3",
    chapter_id: "chapter2",
    order_number: 1,
    url_path: "/page3",
  })

  const frontPage1 = createPage({
    id: "frontpage1",
    chapter_id: "chapter1",
    order_number: 0,
    url_path: "/",
  })

  const frontPage2 = createPage({
    id: "frontpage2",
    chapter_id: "chapter2",
    order_number: 0,
    url_path: "/",
  })

  const sampleChapter1 = createChapter({
    id: "chapter1",
    chapter_number: 1,
    front_page_id: "frontpage1",
  })

  const sampleChapter2 = createChapter({
    id: "chapter2",
    chapter_number: 2,
    front_page_id: "frontpage2",
  })

  const sampleCourseStructure: CourseStructure = {
    course: createCourse({}),
    pages: [samplePage1, samplePage2, samplePage3, frontPage1, frontPage2],
    chapters: [sampleChapter1, sampleChapter2],
    modules: [],
  }

  describe("initial state", () => {
    it("should return the initial state", () => {
      expect(managePageOrderInitialState).toEqual({
        state: "loading",
        chapterIdToPages: null,
        chapterIdToFrontPage: null,
        unsavedChanges: false,
        unsavedChapterChanges: false,
        chapters: null,
      })
    })
  })

  describe("setData action", () => {
    it("should correctly process course structure data", () => {
      const action = {
        type: "setData" as const,
        payload: sampleCourseStructure,
      }

      const nextState = managePageOrderReducer(managePageOrderInitialState, action)

      expect(nextState.state).toBe("ready")
      expect(nextState.unsavedChanges).toBe(false)
      expect(nextState.unsavedChapterChanges).toBe(false)
      expect(nextState.chapters).toEqual(sampleCourseStructure.chapters)
      expect(nextState.chapterIdToPages?.["chapter1"]?.length).toBe(2)
      expect(nextState.chapterIdToPages?.["chapter2"]?.length).toBe(1)
      expect(nextState.chapterIdToFrontPage?.["chapter1"]).toEqual(frontPage1)
      expect(nextState.chapterIdToFrontPage?.["chapter2"]).toEqual(frontPage2)
    })

    it("should handle course structure with no front pages", () => {
      const chapterWithoutFrontPage = createChapter({
        id: "chapter1",
        front_page_id: null,
      })

      const action = {
        type: "setData" as const,
        payload: {
          course: createCourse({}),
          pages: [samplePage1, samplePage2],
          chapters: [chapterWithoutFrontPage],
          modules: [],
        },
      }

      const nextState = managePageOrderReducer(managePageOrderInitialState, action)

      expect(nextState.state).toBe("ready")
      expect(nextState.chapterIdToPages?.["chapter1"]?.length).toBe(2)
      expect(Object.keys(nextState.chapterIdToFrontPage || {})).toHaveLength(0)
    })
  })

  describe("move action", () => {
    let readyState: ManagePageOrderState

    beforeEach(() => {
      const setDataAction = {
        type: "setData" as const,
        payload: sampleCourseStructure,
      }
      readyState = managePageOrderReducer(managePageOrderInitialState, setDataAction)
    })

    describe("move page within chapter", () => {
      it("should move a page up within a chapter", () => {
        const action = {
          type: "move" as const,
          payload: {
            chapterId: "chapter1",
            pageId: "page2",
            direction: "up" as const,
          },
        }

        const nextState = managePageOrderReducer(readyState, action)

        expect(nextState.unsavedChanges).toBe(true)
        const pages = nextState.chapterIdToPages?.["chapter1"] || []
        expect(pages[0].id).toBe("page2")
        expect(pages[1].id).toBe("page1")
        expect(pages[0].order_number).toBe(1)
        expect(pages[1].order_number).toBe(2)
      })

      it("should move a page down within a chapter", () => {
        const action = {
          type: "move" as const,
          payload: {
            chapterId: "chapter1",
            pageId: "page1",
            direction: "down" as const,
          },
        }

        const nextState = managePageOrderReducer(readyState, action)

        expect(nextState.unsavedChanges).toBe(true)
        const pages = nextState.chapterIdToPages?.["chapter1"] || []
        expect(pages[0].id).toBe("page2")
        expect(pages[1].id).toBe("page1")
      })
    })

    describe("move page between chapters", () => {
      it("should move a page to a different chapter", () => {
        const action = {
          type: "move" as const,
          payload: {
            chapterId: "chapter2",
            pageId: "page1",
            direction: "down" as const,
          },
        }

        const nextState = managePageOrderReducer(readyState, action)

        expect(nextState.unsavedChanges).toBe(true)
        expect(nextState.chapterIdToPages?.["chapter1"]?.length).toBe(1)
        expect(nextState.chapterIdToPages?.["chapter2"]?.length).toBe(2)
        expect(nextState.chapterIdToPages?.["chapter2"]?.[1].id).toBe("page1")
        expect(nextState.chapterIdToPages?.["chapter2"]?.[1].chapter_id).toBe("chapter2")
        expect(nextState.chapterIdToPages?.["chapter2"]?.[1].order_number).toBe(2)
      })
    })

    describe("move chapter", () => {
      it("should move a chapter up", () => {
        const action = {
          type: "move" as const,
          payload: {
            chapterId: "chapter2",
            pageId: null,
            direction: "up" as const,
          },
        }

        const nextState = managePageOrderReducer(readyState, action)

        expect(nextState.unsavedChapterChanges).toBe(true)
        const chapters = nextState.chapters || []
        expect(chapters.find((c) => c.id === "chapter1")?.chapter_number).toBe(2)
        expect(chapters.find((c) => c.id === "chapter2")?.chapter_number).toBe(1)
      })

      it("should move a chapter down", () => {
        const action = {
          type: "move" as const,
          payload: {
            chapterId: "chapter1",
            pageId: null,
            direction: "down" as const,
          },
        }

        const nextState = managePageOrderReducer(readyState, action)

        expect(nextState.unsavedChapterChanges).toBe(true)
        const chapters = nextState.chapters || []
        expect(chapters.find((c) => c.id === "chapter1")?.chapter_number).toBe(2)
        expect(chapters.find((c) => c.id === "chapter2")?.chapter_number).toBe(1)
      })
    })

    describe("order number normalization", () => {
      it("should fix gaps in page order numbers", () => {
        const pageWithGap = createPage({
          ...samplePage2,
          order_number: 5,
        })

        const gappyStructure: CourseStructure = {
          course: createCourse({}),
          pages: [samplePage1, pageWithGap, samplePage3, frontPage1, frontPage2],
          chapters: [sampleChapter1, sampleChapter2],
          modules: [],
        }

        const action = {
          type: "setData" as const,
          payload: gappyStructure,
        }

        const nextState = managePageOrderReducer(managePageOrderInitialState, action)

        expect(nextState.unsavedChanges).toBe(true)
        const pages = nextState.chapterIdToPages?.["chapter1"] || []
        expect(pages[0].order_number).toBe(1)
        expect(pages[1].order_number).toBe(2)
      })

      it("should fix gaps in chapter numbers", () => {
        const chapterWithGap = createChapter({
          ...sampleChapter2,
          chapter_number: 5,
        })

        const gappyStructure: CourseStructure = {
          course: createCourse({}),
          pages: [samplePage1, samplePage2, samplePage3, frontPage1, frontPage2],
          chapters: [sampleChapter1, chapterWithGap],
          modules: [],
        }

        const action = {
          type: "setData" as const,
          payload: gappyStructure,
        }

        const nextState = managePageOrderReducer(managePageOrderInitialState, action)

        expect(nextState.unsavedChapterChanges).toBe(true)
        const chapters = nextState.chapters || []
        expect(chapters[0].chapter_number).toBe(1)
        expect(chapters[1].chapter_number).toBe(2)
      })
    })
  })
})
