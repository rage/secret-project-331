"use client"

import { useTranslation } from "react-i18next"

import { endExamTime } from "@/services/course-material/backend"
import Button from "@/shared-module/common/components/Button"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

export interface EndExamButtonProps {
  examId: string
  disabled: boolean
  onEnded: () => Promise<void>
}

/** End-exam button with confirm dialog and endExamTime mutation. */
export default function EndExamButton({ examId, disabled, onEnded }: EndExamButtonProps) {
  const { t } = useTranslation()
  const { confirm } = useDialog()

  const endExamMutation = useToastMutation(
    () => endExamTime(examId),
    { notify: true, method: "POST" },
    { onSuccess: onEnded },
  )

  const handleEndExam = () => {
    endExamMutation.mutate()
  }

  if (disabled) {
    return null
  }

  return (
    <Button
      variant={"primary"}
      size={"small"}
      onClick={async () => {
        const confirmation = await confirm(t("message-do-you-want-to-end-the-exam"))
        if (confirmation) {
          handleEndExam()
        }
      }}
    >
      {t("button-end-exam")}
    </Button>
  )
}
