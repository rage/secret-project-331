import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import ClaimCode from "./ClaimCode"

import { getCodeGiveawayStatus } from "@/services/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface CodeGiveawayBlockProps {
  code_giveaway_id: string | undefined | null
}

const Wrapper = styled.div`
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 1rem;
`

const CodeGiveawayBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<CodeGiveawayBlockProps>>
> = (props) => {
  const { t } = useTranslation()
  const loginContext = useContext(LoginStateContext)

  const codeGiveawayId = props.data.attributes.code_giveaway_id

  const codeGiveawayStatusQuery = useQuery({
    queryKey: ["fetchCodeGiveawayStatus", codeGiveawayId],
    queryFn: () => getCodeGiveawayStatus(assertNotNullOrUndefined(codeGiveawayId)),
    enabled: Boolean(!!codeGiveawayId && loginContext.signedIn),
  })

  if (!codeGiveawayId) {
    return <ErrorBanner variant="readOnly" error={t("error-no-code-giveaway-id")} />
  }

  if (!loginContext.signedIn || codeGiveawayStatusQuery.isLoading) {
    return null
  }

  if (codeGiveawayStatusQuery.isError) {
    return <ErrorBanner error={codeGiveawayStatusQuery.error} variant="readOnly" />
  }

  if (
    codeGiveawayStatusQuery.data?.tag === "Disabled" ||
    codeGiveawayStatusQuery.data?.tag === "NotEligible" ||
    !codeGiveawayStatusQuery.data
  ) {
    return null
  }

  if (codeGiveawayStatusQuery.data?.tag === "Eligible") {
    return (
      <Wrapper>
        <InnerBlocks parentBlockProps={props} />
        <ClaimCode
          codeGiveawayId={codeGiveawayId}
          onClaimed={() => codeGiveawayStatusQuery.refetch()}
        />
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <InnerBlocks parentBlockProps={props} />
      <p>{t("your-code-code", { code: codeGiveawayStatusQuery.data.given_code })}</p>
    </Wrapper>
  )
}

export default CodeGiveawayBlock
