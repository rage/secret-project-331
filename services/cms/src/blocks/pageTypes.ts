import type {
  CourseBlockFeature,
  CourseBlockFeatures,
  PageType,
} from "@/generated/api/types.generated"

export type { CourseBlockFeatures, PageType }

// A Record so that a page type headless-lms adds fails to compile until it is listed here.
const PAGE_TYPE_SET: Record<PageType, true> = {
  "course-page": true,
  "top-level-page": true,
  "course-front-page": true,
}

/** Course page kinds whose editors offer different blocks. */
export const PAGE_TYPES = Object.keys(PAGE_TYPE_SET) as PageType[]

/** Every feature on, for the blocks a page type can hold in any course. */
export const ALL_COURSE_FEATURES: CourseBlockFeatures = {
  chapter_locking_enabled: true,
  can_add_chatbot: true,
}

/** The course setting a block needs. */
export interface CourseFeatureGate {
  setting: CourseBlockFeature
  /** What an agent writing the block without the setting should do. */
  fix: string
}

/** Blocks a chapter page offers only when a course setting enables them. */
export const COURSE_FEATURE_GATES: Readonly<Record<string, CourseFeatureGate>> = {
  "moocfi/lock-chapter": {
    setting: "chapter_locking_enabled",
    fix: "It needs chapter locking turned on in the course settings; remove the block or ask the teacher.",
  },
  "moocfi/chatbot": {
    setting: "can_add_chatbot",
    fix: "The course can't have a chatbot; remove the block.",
  },
}

/**
 * The page type of a page in the CMS. Exam pages edit like chapter pages, and a chapter's front page
 * can't be told apart from its other pages here; both get the same blocks.
 */
export const pageTypeOfPage = (
  chapterId: string | null,
  examId: string | null,
  urlPath: string,
): PageType => {
  if (chapterId !== null || examId !== null) {
    return "course-page"
  }
  return urlPath === "/" ? "course-front-page" : "top-level-page"
}
