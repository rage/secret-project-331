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
  gap: 1rem;
  flex-wrap: wrap;
`

const StyledLink = styled.a`
  padding: 1rem;
  font-size: 18px;
  line-height: 1.1;
  color: #044743 !important;
  text-decoration: underline;
`

export interface CongratulationsLinksProps {
  courseInstanceId: string
  module: UserModuleCompletionStatus
}

const CongratulationsLinks: React.FC<React.PropsWithChildren<CongratulationsLinksProps>> = ({
  courseInstanceId,
  module,
}) => {
  const { t } = useTranslation()
  const isReady = false
  if (module.grade === 0 || module.passed === false) {
    return null
  }
  return (
    <CTAWrapper>
      {module.enable_registering_completion_to_uh_open_university && (
        <a
          href={`${COMPLETION_REGISTRATION_BASE_PATH}/${module.module_id}`}
          aria-label={`Register completion for ${module.name}`}
        >
          <Button variant="tertiary" size="large" disabled={!module.completed}>
            {t("register")}
          </Button>
        </a>
      )}
      {module.certification_enabled && (
        <a
          href={`/module-certificate?module=${module.module_id}&instance=${courseInstanceId}`}
          aria-label={`Generate certificate for completing ${module.name}`}
        >
          <Button variant="tertiary" size="large" disabled={!module.completed}>
            {t("generate-certificate-button-label")}
          </Button>
        </a>
      )}
      {isReady && <StyledLink>{t("generate-certicate")}</StyledLink>}
    </CTAWrapper>
  )
}

export default CongratulationsLinks
