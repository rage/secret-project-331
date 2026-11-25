"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getCourseModelSolutionSettingsOptions,
  getCourseModelSolutionSettingsQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { updateCourseModelSolutionSettings } from "@/generated/api/sdk.generated"
import type { CourseModelSolutionSettings } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import { Button, Checkbox, DateTimeLocalField, QueryResults } from "@/shared-module/components"

interface FormFields {
  revealAfterDeadline: boolean
  /** Local `YYYY-MM-DDTHH:mm`, or empty for never. */
  revealAt: string
}

interface Props {
  courseId: string
}

/** When the course shows model solutions to students who have not earned them by their progress. */
const ModelSolutionSettings: React.FC<Props> = ({ courseId }) => {
  const settingsQuery = useQuery(
    getCourseModelSolutionSettingsOptions({ path: { course_id: courseId } }),
  )
  return (
    <QueryResults
      queries={[settingsQuery] as const}
      renderData={([settings]) => <SettingsForm courseId={courseId} settings={settings} />}
    />
  )
}

const SettingsForm: React.FC<Props & { settings: CourseModelSolutionSettings }> = ({
  courseId,
  settings,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { control, handleSubmit } = useForm<FormFields>({
    defaultValues: {
      revealAfterDeadline: settings.reveal_after_deadline,
      revealAt: formatDateForDateTimeLocalInputs(settings.reveal_at) ?? "",
    },
  })
  const saveMutation = useToastMutation(
    async (fields: FormFields) =>
      await updateCourseModelSolutionSettings({
        path: { course_id: courseId },
        body: {
          reveal_after_deadline: fields.revealAfterDeadline,
          reveal_at: fields.revealAt ? new Date(fields.revealAt).toISOString() : null,
        },
      }),
    { method: "PUT", notify: true },
    {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getCourseModelSolutionSettingsQueryKey({ path: { course_id: courseId } }),
        }),
    },
  )
  return (
    <form
      onSubmit={handleSubmit((fields) => saveMutation.mutate(fields))}
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 40rem;
      `}
    >
      <p>{t("model-solution-settings-description")}</p>
      <Checkbox
        name="revealAfterDeadline"
        control={control}
        label={t("label-reveal-model-solutions-after-deadline")}
      />
      <DateTimeLocalField
        name="revealAt"
        control={control}
        label={t("label-reveal-model-solutions-at")}
      />
      <div>
        <Button variant="primary" size="medium" type="submit" disabled={saveMutation.isPending}>
          {t("button-text-save")}
        </Button>
      </div>
    </form>
  )
}

export default ModelSolutionSettings
