import { z } from "zod"

import type { ClientToolName } from "@/generated/course-material-api/types.generated"
import { parseJsonWithSchema } from "@/shared-module/common/utils/parseJsonWithSchema"

/**
 * The client tool this UI answers, matching `GeneratePasswordResetLinkTool::NAME` in
 * `services/headless-lms/chatbot/src/chatbot_tools/action_tools/generate_password_reset_link.rs`.
 */
export const GENERATE_PASSWORD_RESET_LINK_TOOL: ClientToolName = "generate_password_reset_link"

const rawArguments = z.object({
  user_id: z.string(),
  user_email: z.string(),
})

export interface PasswordResetLinkCall {
  toolCallId: string
  userId: string
  userEmail: string
}

const zPasswordResetLinkCall = z.object({
  toolCallId: z.string(),
  userId: z.string(),
  userEmail: z.string(),
})

/**
 * Narrows a client tool registry entry's `unknown` call back to this tool's own type. Always true
 * for a call this tool's own `parseCall` produced; exists so the registry never needs a cast to
 * cross that boundary.
 */
export const isPasswordResetLinkCall = (call: unknown): call is PasswordResetLinkCall =>
  zPasswordResetLinkCall.safeParse(call).success

/**
 * The call's display fields, or null if the raw arguments cannot be made sense of. This is the
 * client tool registry's `parseCall` for this tool; the backend re-verifies `userEmail` against
 * the account before generating anything, so a stale or malformed value here only ever produces a
 * bubble the admin can decline.
 */
export const parsePasswordResetLinkCall = (
  toolCallId: string,
  toolArguments: string,
): PasswordResetLinkCall | null => {
  const args = parseJsonWithSchema(toolArguments, rawArguments)
  if (!args) {
    return null
  }
  const userId = args.user_id.trim()
  const userEmail = args.user_email.trim()
  if (userId.length === 0 || userEmail.length === 0) {
    return null
  }
  return { toolCallId, userId, userEmail }
}

/**
 * What `GeneratePasswordResetLinkTool::execute`'s `client_payload` carries: the reset link, sent
 * to this browser only via the `ActionExecuted` stream event and never persisted.
 */
const zExecutionPayload = z.object({ reset_link: z.string() })

/** The reset link from a call's `executionPayload`, or null if it is missing or malformed (a page
 * reload after execution, which never receives the event again). */
export const resetLinkOf = (executionPayload: unknown): string | null => {
  const parsed = zExecutionPayload.safeParse(executionPayload)
  return parsed.success ? parsed.data.reset_link : null
}
