"use client"

import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createCodeGiveawayMutation as createCodeGiveawayMutationOptions } from "@/generated/api/@tanstack/react-query.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { nullIfEmptyString } from "@/shared-module/common/utils/strings"
import { Dialog, TextField } from "@/shared-module/components"

interface NewCodeGiveawayFormProps {
  courseId: string
  dialogOpen: boolean
  setDialogOpen: (dialogOpen: boolean) => void
  onCreated?: () => void
}

interface NewCodeGiveawayFields {
  name: string
  courseModuleId: string
  requireCourseSpecificConsentFormQuestionId: string
}

const NewCodeGiveawayForm: React.FC<NewCodeGiveawayFormProps> = ({
  courseId,
  dialogOpen,
  setDialogOpen,
  onCreated,
}) => {
  const { control, watch, reset } = useForm<NewCodeGiveawayFields>({
    defaultValues: { name: "", courseModuleId: "", requireCourseSpecificConsentFormQuestionId: "" },
  })
  const name = watch("name")
  const courseModuleId = watch("courseModuleId")
  const requireCourseSpecificConsentFormQuestionId = watch(
    "requireCourseSpecificConsentFormQuestionId",
  )

  const valid = name.trim() !== ""
  const { t } = useTranslation()

  const createCodeGiveawayMutation = useToastMutationOptions(
    createCodeGiveawayMutationOptions(),
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        reset()
        setDialogOpen(false)
        if (onCreated) {
          onCreated()
        }
      },
    },
  )
  if (!dialogOpen) {
    return null
  }
  return (
    <Dialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      title={t("heading-new-code-giveaway")}
      actions={[
        {
          variant: "primary",
          onClick: () =>
            createCodeGiveawayMutation.mutate({
              body: {
                course_id: courseId,
                name,
                course_module_id: nullIfEmptyString(courseModuleId.trim()),
                require_course_specific_consent_form_question_id: nullIfEmptyString(
                  requireCourseSpecificConsentFormQuestionId.trim(),
                ),
              },
            }),
          disabled: !valid || createCodeGiveawayMutation.isPending,
          label: t("button-text-create"),
        },
      ]}
    >
      <TextField name="name" control={control} label={t("label-name")} />
      <TextField name="courseModuleId" control={control} label={t("label-course-module-id")} />
      <TextField
        name="requireCourseSpecificConsentFormQuestionId"
        control={control}
        label={t("label-require-course-specific-consent-form-question-id")}
      />
    </Dialog>
  )
}

export default NewCodeGiveawayForm
