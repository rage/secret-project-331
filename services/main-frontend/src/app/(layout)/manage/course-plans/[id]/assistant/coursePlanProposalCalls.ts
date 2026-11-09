import { z } from "zod"

import type { ClientToolName } from "@/generated/course-material-api/types.generated"

/**
 * The assistant's proposal tools, by the names in
 * `services/headless-lms/chatbot/src/chatbot_tools/course_plan_tools/`. Each schema is the raw
 * argument shape that tool's `parse_arguments` validates further server-side.
 */
export const PROPOSE_WORKSPACE_EDIT_TOOL = "propose_workspace_edit" satisfies ClientToolName
export const PROPOSE_ADD_TASK_TOOL = "propose_add_task" satisfies ClientToolName
export const PROPOSE_UPDATE_TASK_TOOL = "propose_update_task" satisfies ClientToolName
export const PROPOSE_SCHEDULE_ADJUSTMENT_TOOL =
  "propose_schedule_adjustment" satisfies ClientToolName
export const PROPOSE_SECTION_STATUS_TOOL = "propose_section_status" satisfies ClientToolName
export const PROPOSE_VISION_EDIT_TOOL = "propose_vision_edit" satisfies ClientToolName

export const workspaceEditCallSchema = z.object({
  stage: z.string(),
  summary: z.string(),
  changes: z
    .array(
      z.object({
        field: z.string(),
        current_value_json: z.string(),
        proposed_value_json: z.string(),
      }),
    )
    .min(1),
})
export type WorkspaceEditCall = z.infer<typeof workspaceEditCallSchema>

export const addTaskCallSchema = z.object({
  stage: z.string(),
  title: z.string(),
  description: z.string(),
  assignee_name: z.string(),
})
export type AddTaskCall = z.infer<typeof addTaskCallSchema>

export const updateTaskCallSchema = z.object({
  task_id: z.string(),
  task_title: z.string(),
  changes: z
    .array(
      z.object({
        field: z.string(),
        current_value: z.string(),
        proposed_value: z.string(),
      }),
    )
    .min(1),
})
export type UpdateTaskCall = z.infer<typeof updateTaskCallSchema>

const stageDatesSchema = z.object({
  stage: z.string(),
  starts_on: z.string(),
  ends_on: z.string(),
})
export type StageDates = z.infer<typeof stageDatesSchema>

export const scheduleAdjustmentCallSchema = z.object({
  reason: z.string(),
  current_schedule: z.array(stageDatesSchema),
  proposed_schedule: z.array(stageDatesSchema),
})
export type ScheduleAdjustmentCall = z.infer<typeof scheduleAdjustmentCallSchema>

export const sectionStatusCallSchema = z.object({
  stage: z.string(),
  section_key: z.string(),
  current_status: z.string(),
  current_comment: z.string(),
  proposed_status: z.string(),
  proposed_comment: z.string(),
})
export type SectionStatusCall = z.infer<typeof sectionStatusCallSchema>

export const visionEditCallSchema = z.object({
  current_vision: z.string(),
  proposed_vision: z.string(),
})
export type VisionEditCall = z.infer<typeof visionEditCallSchema>
