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

export interface CourseDesignerPlanStageTask {
  id: string
  created_at: string
  updated_at: string
  course_designer_plan_stage_id: string
  title: string
  description: string | null
  order_number: number
  is_completed: boolean
  completed_at: string | null
  completed_by_user_id: string | null
  is_auto_generated: boolean
  created_by_user_id: string | null
}

export type CourseDesignerPlanStageWithTasks = CourseDesignerPlanStage & {
  tasks: Array<CourseDesignerPlanStageTask>
}

export interface CourseDesignerPlanDetails {
  plan: CourseDesignerPlan
  members: Array<CourseDesignerPlanMember>
  stages: Array<CourseDesignerPlanStageWithTasks>
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

export const startCourseDesignerPlan = async (planId: string): Promise<CourseDesignerPlan> => {
  const response = await mainFrontendClient.post(`/course-plans/${planId}/start`)
  return response.data as CourseDesignerPlan
}

export const extendCourseDesignerStage = async (
  planId: string,
  stage: CourseDesignerStage,
  months: number,
): Promise<CourseDesignerPlanDetails> => {
  const stagePath = stage.toLowerCase()
  const response = await mainFrontendClient.post(
    `/course-plans/${planId}/stages/${stagePath}/extend`,
    { months },
  )
  return response.data as CourseDesignerPlanDetails
}

export const advanceCourseDesignerStage = async (
  planId: string,
): Promise<CourseDesignerPlanDetails> => {
  const response = await mainFrontendClient.post(`/course-plans/${planId}/stages/advance`)
  return response.data as CourseDesignerPlanDetails
}

export interface CreateCourseDesignerStageTaskRequest {
  title: string
  description?: string | null
}

export const createCourseDesignerStageTask = async (
  planId: string,
  stageId: string,
  payload: CreateCourseDesignerStageTaskRequest,
): Promise<CourseDesignerPlanStageTask> => {
  const response = await mainFrontendClient.post(
    `/course-plans/${planId}/stages/${stageId}/tasks`,
    payload,
  )
  return response.data as CourseDesignerPlanStageTask
}

export interface UpdateCourseDesignerStageTaskRequest {
  title?: string | null
  description?: string | null
  is_completed?: boolean
}

export const updateCourseDesignerStageTask = async (
  planId: string,
  taskId: string,
  payload: UpdateCourseDesignerStageTaskRequest,
): Promise<CourseDesignerPlanStageTask> => {
  const response = await mainFrontendClient.patch(
    `/course-plans/${planId}/tasks/${taskId}`,
    payload,
  )
  return response.data as CourseDesignerPlanStageTask
}

export const deleteCourseDesignerStageTask = async (
  planId: string,
  taskId: string,
): Promise<void> => {
  await mainFrontendClient.delete(`/course-plans/${planId}/tasks/${taskId}`)
}
