"use client"

import React from "react"
import type { z } from "zod"

import type {
  ClientToolBubbleProps,
  ClientToolRegistryEntry,
} from "@/components/course-material/chatbot/shared/clientToolRegistry"
import { parseJsonWithSchema } from "@/shared-module/common/utils/parseJsonWithSchema"

import {
  addTaskCallSchema,
  PROPOSE_ADD_TASK_TOOL,
  PROPOSE_SCHEDULE_ADJUSTMENT_TOOL,
  PROPOSE_SECTION_STATUS_TOOL,
  PROPOSE_UPDATE_TASK_TOOL,
  PROPOSE_VISION_EDIT_TOOL,
  PROPOSE_WORKSPACE_EDIT_TOOL,
  scheduleAdjustmentCallSchema,
  sectionStatusCallSchema,
  updateTaskCallSchema,
  visionEditCallSchema,
  workspaceEditCallSchema,
} from "./coursePlanProposalCalls"
import {
  AddTaskBubble,
  ScheduleAdjustmentBubble,
  SectionStatusBubble,
  UpdateTaskBubble,
  VisionEditBubble,
  WorkspaceEditBubble,
} from "./ProposalBubbles"

const proposalEntry = <TCall,>(
  schema: z.ZodType<TCall>,
  Bubble: React.FC<ClientToolBubbleProps<TCall>>,
): ClientToolRegistryEntry => ({
  parseCall: (_toolCallId, toolArguments) => parseJsonWithSchema(toolArguments, schema),
  renderBubble: (props) => <Bubble {...props} call={props.call as TCall} />,
  showsAnswerError: true,
})

/** Registry entries for the course design assistant's proposals, applied or discarded by the user. */
export const COURSE_PLAN_TOOL_REGISTRY: Record<string, ClientToolRegistryEntry> = {
  [PROPOSE_WORKSPACE_EDIT_TOOL]: proposalEntry(workspaceEditCallSchema, WorkspaceEditBubble),
  [PROPOSE_ADD_TASK_TOOL]: proposalEntry(addTaskCallSchema, AddTaskBubble),
  [PROPOSE_UPDATE_TASK_TOOL]: proposalEntry(updateTaskCallSchema, UpdateTaskBubble),
  [PROPOSE_SCHEDULE_ADJUSTMENT_TOOL]: proposalEntry(
    scheduleAdjustmentCallSchema,
    ScheduleAdjustmentBubble,
  ),
  [PROPOSE_SECTION_STATUS_TOOL]: proposalEntry(sectionStatusCallSchema, SectionStatusBubble),
  [PROPOSE_VISION_EDIT_TOOL]: proposalEntry(visionEditCallSchema, VisionEditBubble),
}
