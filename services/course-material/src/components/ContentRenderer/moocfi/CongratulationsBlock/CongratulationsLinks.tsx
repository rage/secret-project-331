import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserModuleCompletionStatus } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"

const COMPLETION_REGISTRATION_BASE_PATH = `/completion-registration`

const CTAWrapper = styled.div`
  margin-top: 2rem;
  display: flex;
  align-items: center;
`

const StyledLink = styled.a`
  padding: 1rem;
  font-size: 18px;
  line-height: 1.1;
  color: #044743 !important;
  text-decoration: underline;
`

export interface CongratulationsLinksProps {
  module: UserModuleCompletionStatus
}

const CongratulationsLinks: React.FC<React.PropsWithChildren<CongratulationsLinksProps>> = ({
  module,
}) => {
  const { t } = useTranslation()
  return (
    <CTAWrapper>
      <a
        href={`${COMPLETION_REGISTRATION_BASE_PATH}/${module.module_id}`}
        aria-label={`Register completion for ${module.name}`}
      >
        <Button variant="tertiary" size="large" disabled={!module.completed}>
          {t("register")}
        </Button>
      </a>
      <StyledLink>{t("generate-certicate")}</StyledLink>
    </CTAWrapper>
  )
}

export default CongratulationsLinks
