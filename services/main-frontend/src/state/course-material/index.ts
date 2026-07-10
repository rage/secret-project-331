import { atom } from "jotai"

import { viewParamsAtom } from "./params"
import { examQueryAtom, materialQueryAtom } from "./queries"

import type {
  CourseInstance,
  CourseMaterialCourse,
  ExamData,
  Organization,
  Page,
  UserCourseSettings,
} from "@/generated/course-material-api/types.generated"

export type CourseMaterialState = {
  status: "loading" | "ready" | "error"
  error: unknown | null
  page: Page | null
  course: CourseMaterialCourse | null
  instance: CourseInstance | null
  settings: UserCourseSettings | null
  organization: Organization | null
  examData: ExamData | null
  lockChapterContentState: "not_locked" | "waiting_teacher_review" | "visible" | null
  isTestMode: boolean
  wasRedirected: boolean
}

/** Global state atom for course material pages. Provides quick access to commonly needed data such as current page, course, organization, etc. */
export const courseMaterialAtom = atom<CourseMaterialState>((get) => {
  const viewParams = get(viewParamsAtom)

  const emptyState: CourseMaterialState = {
    status: "loading",
    error: null,
    page: null,
    course: null,
    instance: null,
    settings: null,
    organization: null,
    examData: null,
    lockChapterContentState: null,
    isTestMode: false,
    wasRedirected: false,
  }

  if (!viewParams) {
    return emptyState
  }

  if (viewParams.type === "management") {
    return {
      ...emptyState,
      status: "ready",
      organization: viewParams.organization,
      course: viewParams.course,
    }
  }

  if (viewParams.type === "material") {
    const { data, isLoading, isError, error } = get(materialQueryAtom)
    if (isLoading) {
      return emptyState
    }
    if (isError) {
      return { ...emptyState, status: "error", error }
    }
    if (!data) {
      return emptyState
    }

    return {
      status: "ready",
      error: null,
      page: data.page ?? null,
      course: data.course ?? null,
      instance: data.instance ?? null,
      settings: data.settings ?? null,
      organization: data.organization ?? null,
      examData: null,
      lockChapterContentState: data.lock_chapter_content_state ?? null,
      isTestMode: data.is_test_mode ?? false,
      wasRedirected: data.was_redirected ?? false,
    }
  }

  if (viewParams.type === "exam") {
    const { data, isLoading, isError, error } = get(examQueryAtom)
    if (isLoading) {
      return emptyState
    }
    if (isError) {
      return { ...emptyState, status: "error", error }
    }
    if (!data) {
      return emptyState
    }

    // oxlint-disable-next-line typescript/no-explicit-any
    const enrollmentData = (data as any).enrollment_data
    const examPage = enrollmentData?.tag === "EnrolledAndStarted" ? enrollmentData.page : null

    return {
      status: "ready",
      error: null,
      page: examPage,
      course: null,
      instance: null,
      settings: null,
      organization: null,
      examData: data as ExamData,
      lockChapterContentState: null,
      isTestMode: viewParams.isTestMode,
      wasRedirected: false,
    }
  }

  return emptyState
})
