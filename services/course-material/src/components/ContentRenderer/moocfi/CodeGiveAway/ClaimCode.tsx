import { useTranslation } from "react-i18next"

import { claimCodeFromCodeGiveaway } from "@/services/backend"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface ClaimCodeProps {
  codeGiveawayId: string
  onClaimed: () => void
}

const ClaimCode: React.FC<ClaimCodeProps> = ({ codeGiveawayId, onClaimed }) => {
  const { t } = useTranslation()

  const claimCodeMutation = useToastMutation(
    () => claimCodeFromCodeGiveaway(assertNotNullOrUndefined(codeGiveawayId)),
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
