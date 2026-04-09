"use client"

import { useTranslation } from "react-i18next"

import { claimCodeFromCodeGiveaway } from "@/generated/course-material-api/sdk.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

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
        throwOnError: true,
      }),
    { notify: false },
  )

  return (
    <>
      {claimCodeMutation.isError && (
        <ErrorBanner error={claimCodeMutation.error} variant="readOnly" />
      )}
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
