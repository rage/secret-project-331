import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

import PageContext from "@/contexts/PageContext"
import useUserModuleCompletions from "@/hooks/useUserModuleCompletions"
import {
  claimCodeFromCodeGiveaway,
  fetchCodesLeftInCodeGiveaway,
  fetchGivenCodeFromCodeGiveaway,
} from "@/services/backend"
import { UserCourseSettings } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
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
  const pageContext = useContext(PageContext)

  const codeGiveawayId = props.data.attributes.code_giveaway_id

  const givenCodeQuery = useQuery({
    queryKey: ["fetchGivenCodeFromCodeGiveaway", codeGiveawayId],
    queryFn: () => fetchGivenCodeFromCodeGiveaway(assertNotNullOrUndefined(codeGiveawayId)),
    enabled: !!codeGiveawayId,
  })

  const codesLeftQuery = useQuery({
    queryKey: ["fetchCodesLeftInCodeGiveaway", codeGiveawayId],
    queryFn: () => fetchCodesLeftInCodeGiveaway(assertNotNullOrUndefined(codeGiveawayId)),
    enabled: !!codeGiveawayId,
  })

  const claimCodeMutation = useToastMutation(
    () => claimCodeFromCodeGiveaway(assertNotNullOrUndefined(codeGiveawayId)),
    { notify: false },
  )

  if (!codeGiveawayId) {
    return <ErrorBanner variant="readOnly" error={t("error-no-code-giveaway-id")} />
  }

  return (
    <Wrapper>
      <InnerBlocks parentBlockProps={props} />
    </Wrapper>
  )
}

export default CodeGiveawayBlock
