import { mainFrontendClient } from "../mainFrontendClient"

export type CourseDesignerStage =
  | "Analysis"
  | "Design"
  | "Development"
  | "Implementation"
  | "Evaluation"

export type CourseDesignerPlanStatus =
  | "Draft"
  | "Scheduling"
  | "ReadyToStart"
  | "InProgress"
  | "Completed"
  | "Archived"

export type CourseDesignerPlanStageStatus = "NotStarted" | "InProgress" | "Completed"

export type CourseDesignerCourseSize = "small" | "medium" | "large"

export interface CourseDesignerPlan {
  id: string
  created_at: string
  updated_at: string
  created_by_user_id: string
  name: string | null
  status: CourseDesignerPlanStatus
  active_stage: CourseDesignerStage | null
  last_weekly_stage_email_sent_at: string | null
}

export interface CourseDesignerPlanSummary extends CourseDesignerPlan {
  member_count: number
  stage_count: number
}

export interface CourseDesignerPlanMember {
  id: string
  created_at: string
  updated_at: string
  user_id: string
}

export interface CourseDesignerPlanStage {
  id: string
  created_at: string
  updated_at: string
  stage: CourseDesignerStage
  status: CourseDesignerPlanStageStatus
  planned_starts_on: string
  planned_ends_on: string
  actual_started_at: string | null
  actual_completed_at: string | null
}

export interface CourseDesignerPlanDetails {
  plan: CourseDesignerPlan
  members: Array<CourseDesignerPlanMember>
  stages: Array<CourseDesignerPlanStage>
}

export interface CourseDesignerScheduleStageInput {
  stage: CourseDesignerStage
  planned_starts_on: string
  planned_ends_on: string
}

export interface CreateCourseDesignerPlanRequest {
  name?: string | null
}

export interface CourseDesignerScheduleSuggestionRequest {
  course_size: CourseDesignerCourseSize
  starts_on: string
}

export interface CourseDesignerScheduleSuggestionResponse {
  stages: Array<CourseDesignerScheduleStageInput>
}

export interface SaveCourseDesignerScheduleRequest {
  name?: string | null
  stages: Array<CourseDesignerScheduleStageInput>
}

export const createCourseDesignerPlan = async (
  payload: CreateCourseDesignerPlanRequest = {},
): Promise<CourseDesignerPlan> => {
  const response = await mainFrontendClient.post("/course-plans", payload)
  return response.data as CourseDesignerPlan
}

export const listCourseDesignerPlans = async (): Promise<Array<CourseDesignerPlanSummary>> => {
  const response = await mainFrontendClient.get("/course-plans")
  return response.data as Array<CourseDesignerPlanSummary>
}

export const getCourseDesignerPlan = async (planId: string): Promise<CourseDesignerPlanDetails> => {
  const response = await mainFrontendClient.get(`/course-plans/${planId}`)
  return response.data as CourseDesignerPlanDetails
}

export const generateCourseDesignerScheduleSuggestion = async (
  planId: string,
  payload: CourseDesignerScheduleSuggestionRequest,
): Promise<CourseDesignerScheduleSuggestionResponse> => {
  const response = await mainFrontendClient.post(
    `/course-plans/${planId}/schedule/suggestions`,
    payload,
  )
  return response.data as CourseDesignerScheduleSuggestionResponse
}

export const saveCourseDesignerSchedule = async (
  planId: string,
  payload: SaveCourseDesignerScheduleRequest,
): Promise<CourseDesignerPlanDetails> => {
  const response = await mainFrontendClient.put(`/course-plans/${planId}/schedule`, payload)
  return response.data as CourseDesignerPlanDetails
}

export const finalizeCourseDesignerSchedule = async (
  planId: string,
): Promise<CourseDesignerPlan> => {
  const response = await mainFrontendClient.post(`/course-plans/${planId}/schedule/finalize`)
  return response.data as CourseDesignerPlan
}
