import { queryOptions } from "@tanstack/react-query"

import { getEmailTemplatesOptions as getEmailTemplatesGeneratedOptions } from "@/generated/api/@tanstack/react-query.generated"
import { getEmailTemplates as getEmailTemplatesFromApi } from "@/generated/api/sdk.generated"
import type { EmailTemplate as GeneratedEmailTemplate } from "@/generated/api/types.generated"
import { EmailTemplate } from "@/shared-module/common/bindings"

const normalizeEmailTemplate = (emailTemplate: GeneratedEmailTemplate): EmailTemplate => ({
  ...emailTemplate,
  content: emailTemplate.content ?? null,
  course_id: emailTemplate.course_id ?? null,
  deleted_at: emailTemplate.deleted_at ?? null,
  exercise_completions_threshold: emailTemplate.exercise_completions_threshold ?? null,
  language: emailTemplate.language ?? null,
  points_threshold: emailTemplate.points_threshold ?? null,
  subject: emailTemplate.subject ?? null,
})

export const fetchAllEmailTemplates = async (): Promise<EmailTemplate[]> => {
  const emailTemplates = await getEmailTemplatesFromApi({
    throwOnError: true,
  })

  return emailTemplates.map(normalizeEmailTemplate)
}

export const getAllEmailTemplatesOptions = () =>
  queryOptions({
    ...getEmailTemplatesGeneratedOptions(),
    select: (emailTemplates): EmailTemplate[] => emailTemplates.map(normalizeEmailTemplate),
  })
