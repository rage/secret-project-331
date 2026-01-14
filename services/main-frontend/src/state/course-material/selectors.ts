import { atom } from "jotai"

import { viewParamsAtom } from "./params"
import { examQueryAtom, materialQueryAtom } from "./queries"

import { courseMaterialAtom } from "./index"

import type {
  Course,
  CourseInstance,
  ExamData,
  Organization,
  Page,
  UserCourseSettings,
} from "@/shared-module/common/bindings"

/** Refetches the current view's data (material or exam). */
export const refetchViewAtom = atom(null, async (get, _set) => {
  const viewParams = get(viewParamsAtom)
  if (viewParams?.type === "material") {
    return get(materialQueryAtom).refetch()
  }
  if (viewParams?.type === "exam") {
    return get(examQueryAtom).refetch()
  }
})

/** Current loading status of the course material view. */
export const viewStatusAtom = atom((get) => get(courseMaterialAtom).status)

/** Current page data for the active course material page. */
export const currentPageDataAtom = atom<Page | null>((get) => get(courseMaterialAtom).page)

/** Page title for layout display. */
export const layoutTitleAtom = atom<string | null>(
  (get) => get(courseMaterialAtom).page?.title ?? null,
)

/** ID of the currently active course. */
export const currentCourseIdAtom = atom<string | null>(
  (get) => get(courseMaterialAtom).page?.course_id ?? null,
)

/** ID of the currently active page. */
export const currentPageIdAtom = atom<string | null>(
  (get) => get(courseMaterialAtom).page?.id ?? null,
)

/** ID of the chapter containing the current page. */
export const currentChapterIdAtom = atom<string | null>(
  (get) => get(courseMaterialAtom).page?.chapter_id ?? null,
)

/** Content array of the current page. */
export const pageContentAtom = atom<unknown[]>(
  (get) => (get(courseMaterialAtom).page?.content as unknown[]) ?? [],
)

/** Course ID for layout components. */
export const layoutCourseIdAtom = atom<string | null>((get) => get(currentCourseIdAtom))

/** User-specific course material settings. */
export const materialSettingsAtom = atom<UserCourseSettings | null>(
  (get) => get(courseMaterialAtom).settings,
)

/** Current course instance data. */
export const materialInstanceAtom = atom<CourseInstance | null>(
  (get) => get(courseMaterialAtom).instance,
)

/** Current course data. */
export const materialCourseAtom = atom<Course | null>((get) => get(courseMaterialAtom).course)

/** Current organization data. */
export const materialOrganizationAtom = atom<Organization | null>(
  (get) => get(courseMaterialAtom).organization,
)

/** Current exam data when viewing an exam page. */
export const examDataAtom = atom<ExamData | null>((get) => get(courseMaterialAtom).examData)

/** Whether the current page is a material page with content and chapter. */
export const isMaterialPageAtom = atom<boolean>((get) => {
  const s = get(courseMaterialAtom)
  return s.status === "ready" && Boolean(s.page?.content && s.page?.chapter_id)
})
