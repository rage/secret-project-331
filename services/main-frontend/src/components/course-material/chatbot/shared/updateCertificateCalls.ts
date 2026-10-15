import { z } from "zod"

import type { ClientToolName } from "@/generated/course-material-api/types.generated"
import { parseJsonWithSchema } from "@/shared-module/common/utils/parseJsonWithSchema"

/**
 * The client tool this UI answers, matching `UpdateCertificateTool::NAME` in
 * `services/headless-lms/chatbot/src/chatbot_tools/action_tools/update_certificate.rs`.
 */
export const UPDATE_CERTIFICATE_TOOL: ClientToolName = "update_certificate"

/** The arguments `UpdateCertificateTool::parse_arguments` validates further server-side. */
const rawArguments = z.object({
  certificate_id: z.string(),
  course_id: z.string(),
  current_name_on_certificate: z.string(),
  new_name_on_certificate: z.string(),
  new_date_issued: z.string(),
})

export interface UpdateCertificateCall {
  toolCallId: string
  certificateId: string
  courseId: string
  currentNameOnCertificate: string
  /** Empty string means the printed name is left alone. */
  newNameOnCertificate: string
  /** Empty string means the issue date is left alone. */
  newDateIssued: string
}

/**
 * The call's raw arguments, parsed into what the bubble needs to render, or null if they cannot
 * be made sense of. This is the client tool registry's `parseCall` for this tool.
 */
export const parseUpdateCertificateCall = (
  toolCallId: string,
  toolArguments: string,
): UpdateCertificateCall | null => {
  const args = parseJsonWithSchema(toolArguments, rawArguments)
  if (!args) {
    return null
  }
  const currentNameOnCertificate = args.current_name_on_certificate.trim()
  if (currentNameOnCertificate.length === 0) {
    return null
  }
  return {
    toolCallId,
    certificateId: args.certificate_id,
    courseId: args.course_id,
    currentNameOnCertificate,
    newNameOnCertificate: args.new_name_on_certificate.trim(),
    newDateIssued: args.new_date_issued.trim(),
  }
}

const zUpdateCertificateCall = z.object({
  toolCallId: z.string(),
  certificateId: z.string(),
  courseId: z.string(),
  currentNameOnCertificate: z.string(),
  newNameOnCertificate: z.string(),
  newDateIssued: z.string(),
})

/**
 * Narrows a client tool registry entry's `unknown` call back to this tool's own type. Always true
 * for a call this tool's own `parseUpdateCertificateCall` produced.
 */
export const isUpdateCertificateCall = (call: unknown): call is UpdateCertificateCall =>
  zUpdateCertificateCall.safeParse(call).success
