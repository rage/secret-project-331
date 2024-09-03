import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { createCodeGiveaway } from "@/services/backend/codeGiveaways"
import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/Dialog"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { nullIfEmptyString } from "@/shared-module/common/utils/strings"

type NewCodeGiveawayFormProps = {
  courseId: string
  dialogOpen: boolean
  setDialogOpen: (dialogOpen: boolean) => void
  onCreated?: () => void
}

const NewCodeGiveawayForm: React.FC<NewCodeGiveawayFormProps> = ({
  courseId,
  dialogOpen,
  setDialogOpen,
  onCreated,
}) => {
  const [name, setName] = useState("")
  const [courseModuleId, setCourseModuleId] = useState<string>("")
  const [
    requireCourseSpecificConsentFormQuestionId,
    setRequireCourseSpecificConsentFormQuestionId,
  ] = useState<string>("")

  const valid = useMemo(() => name.trim() !== "", [name])
  const { t } = useTranslation()

  const createCodeGiveawayMutation = useToastMutation(
    () =>
      createCodeGiveaway({
        course_id: courseId,
        name,
        course_module_id: nullIfEmptyString(courseModuleId.trim()),
        require_course_specific_consent_form_question_id: nullIfEmptyString(
          requireCourseSpecificConsentFormQuestionId.trim(),
        ),
      }),
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        setName("")
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
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
      <h1>{t("heading-new-code-giveaway")}</h1>
      <TextField label={t("label-name")} value={name} onChange={(e) => setName(e.target.value)} />
      <TextField
        label={t("label-course-module-id")}
        value={courseModuleId}
        onChange={(e) => setCourseModuleId(e.target.value)}
      />
      <TextField
        label={t("label-require-course-specific-consent-form-question-id")}
        value={requireCourseSpecificConsentFormQuestionId}
        onChange={(e) => setRequireCourseSpecificConsentFormQuestionId(e.target.value)}
      />
      <div>
        <Button
          size="medium"
          variant="primary"
          onClick={() => {
            createCodeGiveawayMutation.mutate()
          }}
          disabled={!valid || createCodeGiveawayMutation.isPending}
        >
          {t("button-text-create")}
        </Button>
        <Button size="medium" variant="secondary" onClick={() => setDialogOpen(false)}>
          {t("button-text-close")}
        </Button>
      </div>
    </Dialog>
  )
}

export default NewCodeGiveawayForm
