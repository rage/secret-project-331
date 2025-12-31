import { atom } from "jotai"

import { viewParamsAtom } from "./params"
import { examQueryAtom, materialQueryAtom } from "./queries"

import type {
  Course,
  CourseInstance,
  ExamData,
  Organization,
  Page,
  UserCourseSettings,
} from "@/shared-module/common/bindings"

export type CourseMaterialState = {
  status: "loading" | "ready" | "error"
  error: unknown | null
  page: Page | null
  course: Course | null
  instance: CourseInstance | null
  settings: UserCourseSettings | null
  organization: Organization | null
  examData: ExamData | null
  isTestMode: boolean
  wasRedirected: boolean
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      isTestMode: viewParams.isTestMode,
      wasRedirected: false,
    }
  }

  return emptyState
})
