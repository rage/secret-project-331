import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { postUpdatePeerReviewQueueReviewsReceived } from "../../../../../../services/backend/courses"

import Button from "@/shared-module/common/components/Button"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

interface ModuleCompletionReprocessButtonProps {
  courseId: string
}

const UpdatePeerReviewQueueReviewsReceivedButton: React.FC<
  React.PropsWithChildren<ModuleCompletionReprocessButtonProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const mutation = useToastMutation(
    async () => {
      return postUpdatePeerReviewQueueReviewsReceived(courseId)
    },
    { notify: true, method: "POST" },
  )

  return (
    <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
      <div
        className={css`
          margin: 1rem 0;
        `}
      >
        <Button
          variant="secondary"
          size="medium"
          onClick={() => {
            if (
              confirm(
                t("message-are-you-sure-you-want-to-update-peer-review-queue-reviews-received"),
              )
            ) {
              return mutation.mutate()
            }
          }}
        >
          {t("update-peer-review-queue-reviews-received")}
        </Button>
      </div>
    </OnlyRenderIfPermissions>
  )
}

export default UpdatePeerReviewQueueReviewsReceivedButton
