"use client"

import { useTranslation } from "react-i18next"

import { claimCodeFromCodeGiveaway } from "@/generated/course-material-api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, ErrorNotice } from "@/shared-module/components"

interface ClaimCodeProps {
  codeGiveawayId: string
  onClaimed: () => void
}

const ClaimCode: React.FC<ClaimCodeProps> = ({ codeGiveawayId, onClaimed }) => {
  const { t } = useTranslation()

  const claimCodeMutation = useToastMutation(
    () =>
      claimCodeFromCodeGiveaway({
        path: {
          id: codeGiveawayId,
        },
      }),
    { notify: false },
  )

  return (
    <>
      {claimCodeMutation.isError && <ErrorNotice error={claimCodeMutation.error} />}
      <Button
        onClick={async () => {
          await claimCodeMutation.mutateAsync()
          onClaimed()
        }}
        variant="primary"
        size="medium"
        disabled={claimCodeMutation.isPending}
      >
        {t("claim-code")}
      </Button>
    </>
  )
}

export default ClaimCode
