"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { reprocessCourseCompletions } from "@/generated/api/sdk.generated"
import Button from "@/shared-module/common/components/Button"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { isBoolean } from "@/shared-module/common/utils/fetching"
import { validateGeneratedData } from "@/utils/validateGeneratedData"

interface ModuleCompletionReprocessButtonProps {
  courseId: string
}

const ModuleCompletionReprocessButton: React.FC<
  React.PropsWithChildren<ModuleCompletionReprocessButtonProps>
> = ({ courseId }) => {
  const { confirm } = useDialog()
  const { t } = useTranslation()
  const postReprocessCompletionsMutation = useToastMutation(
    async () =>
      validateGeneratedData(
        await reprocessCourseCompletions({
          path: {
            course_id: courseId,
          },
        }),
        isBoolean,
      ),
    { notify: true, method: "POST" },
    // { onError: setMutationError },
  )

  return (
    <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
      <Button
        variant="secondary"
        size="medium"
        onClick={async () => {
          if (await confirm(t("message-are-you-sure-you-want-to-reprocess-submissions"))) {
            return postReprocessCompletionsMutation.mutate()
          }
        }}
      >
        {t("reprocess-module-completions")}
      </Button>
    </OnlyRenderIfPermissions>
  )
}

export default ModuleCompletionReprocessButton
