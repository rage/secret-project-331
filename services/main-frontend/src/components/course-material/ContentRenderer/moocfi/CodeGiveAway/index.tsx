"use client"

import styled from "@emotion/styled"
import { skipToken, useQuery } from "@tanstack/react-query"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import type { BlockRendererProps } from "../.."

import ClaimCode from "./ClaimCode"

import InnerBlocks from "@/components/course-material/ContentRenderer/util/InnerBlocks"
import { getCodeGiveawayStatus } from "@/generated/course-material-api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { QueryResult } from "@/shared-module/components"

interface CodeGiveawayBlockProps {
  code_giveaway_id: string | undefined | null
}

const CODE_GIVEAWAY_STATUS_QUERY_KEY = "codeGiveawayStatus"

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
    queryKey: [CODE_GIVEAWAY_STATUS_QUERY_KEY, codeGiveawayId] as const,
    queryFn: codeGiveawayId
      ? () =>
          getCodeGiveawayStatus({
            path: {
              id: codeGiveawayId,
            },
          })
      : skipToken,
    enabled: Boolean(codeGiveawayId && loginContext.signedIn),
  })

  if (!codeGiveawayId) {
    return <ErrorBanner variant="readOnly" error={t("error-no-code-giveaway-id")} />
  }

  if (!loginContext.signedIn) {
    return null
  }

  return (
    <QueryResult query={codeGiveawayStatusQuery}>
      {(data) => {
        if (data.tag === "Disabled" || data.tag === "NotEligible") {
          return null
        }

        if (data.tag === "Eligible") {
          return (
            <Wrapper>
              <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
              <ClaimCode
                codeGiveawayId={codeGiveawayId}
                onClaimed={() => codeGiveawayStatusQuery.refetch()}
              />
            </Wrapper>
          )
        }

        return (
          <Wrapper>
            <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
            <p>{t("your-code-code", { code: data.given_code })}</p>
          </Wrapper>
        )
      }}
    </QueryResult>
  )
}

export default CodeGiveawayBlock
