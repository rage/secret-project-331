import { z } from "zod"

import type { ClientToolName } from "@/generated/course-material-api/types.generated"

import { parseJsonWithSchema } from "./parseJsonWithSchema"

/**
 * The client tool this UI answers, matching `EditUserAccountTool::NAME` in
 * `services/headless-lms/chatbot/src/chatbot_tools/action_tools/edit_user_account.rs`.
 */
export const EDIT_USER_ACCOUNT_TOOL: ClientToolName = "edit_user_account"

const verificationChange = z.union([z.literal(""), z.literal("verify"), z.literal("unverify")])

export type VerificationChange = z.infer<typeof verificationChange>

/** The arguments `EditUserAccountTool::parse_arguments` validates further server-side. */
const rawArguments = z.object({
  user_id: z.string(),
  current_email: z.string(),
  new_email: z.string(),
  mark_email_verified: verificationChange,
})

export interface EditUserAccountCall {
  toolCallId: string
  userId: string
  currentEmail: string
  /** Empty string means no change. */
  newEmail: string
  markEmailVerified: VerificationChange
}

/**
 * The call's raw arguments, parsed into what the bubble needs to render, or null if they cannot
 * be made sense of. This is the client tool registry's `parseCall` for this tool.
 */
export const parseEditUserAccountCall = (
  toolCallId: string,
  toolArguments: string,
): EditUserAccountCall | null => {
  const args = parseJsonWithSchema(toolArguments, rawArguments)
  if (!args) {
    return null
  }
  const currentEmail = args.current_email.trim()
  if (currentEmail.length === 0) {
    return null
  }
  return {
    toolCallId,
    userId: args.user_id,
    currentEmail,
    newEmail: args.new_email.trim(),
    markEmailVerified: args.mark_email_verified,
  }
}

const zEditUserAccountCall = z.object({
  toolCallId: z.string(),
  userId: z.string(),
  currentEmail: z.string(),
  newEmail: z.string(),
  markEmailVerified: verificationChange,
})

/**
 * Narrows a client tool registry entry's `unknown` call back to this tool's own type. Always true
 * for a call this tool's own `parseEditUserAccountCall` produced.
 */
export const isEditUserAccountCall = (call: unknown): call is EditUserAccountCall =>
  zEditUserAccountCall.safeParse(call).success
