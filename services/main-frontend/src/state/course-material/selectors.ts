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

export const refetchViewAtom = atom(null, async (get, _set) => {
  const viewParams = get(viewParamsAtom)
  if (viewParams?.type === "material") {
    return get(materialQueryAtom).refetch()
  }
  if (viewParams?.type === "exam") {
    return get(examQueryAtom).refetch()
  }
})

export const viewStatusAtom = atom((get) => get(courseMaterialAtom).status)

export const currentPageDataAtom = atom<Page | null>((get) => get(courseMaterialAtom).page)

export const layoutTitleAtom = atom<string | null>(
  (get) => get(courseMaterialAtom).page?.title ?? null,
)

export const currentCourseIdAtom = atom<string | null>(
  (get) => get(courseMaterialAtom).page?.course_id ?? null,
)

export const currentPageIdAtom = atom<string | null>(
  (get) => get(courseMaterialAtom).page?.id ?? null,
)

export const currentChapterIdAtom = atom<string | null>(
  (get) => get(courseMaterialAtom).page?.chapter_id ?? null,
)

export const pageContentAtom = atom<unknown[]>(
  (get) => (get(courseMaterialAtom).page?.content as unknown[]) ?? [],
)

export const layoutCourseIdAtom = atom<string | null>((get) => get(currentCourseIdAtom))

export const materialSettingsAtom = atom<UserCourseSettings | null>(
  (get) => get(courseMaterialAtom).settings,
)

export const materialInstanceAtom = atom<CourseInstance | null>(
  (get) => get(courseMaterialAtom).instance,
)

export const materialCourseAtom = atom<Course | null>((get) => get(courseMaterialAtom).course)

export const materialOrganizationAtom = atom<Organization | null>(
  (get) => get(courseMaterialAtom).organization,
)

export const examDataAtom = atom<ExamData | null>((get) => get(courseMaterialAtom).examData)

export const isMaterialPageAtom = atom<boolean>((get) => {
  const s = get(courseMaterialAtom)
  return s.status === "ready" && Boolean(s.page?.content && s.page?.chapter_id)
})
