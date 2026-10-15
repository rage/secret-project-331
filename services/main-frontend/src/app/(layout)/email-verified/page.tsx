"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Infobox, Link, TONE } from "@/shared-module/components"

const EmailVerifiedPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-email-verified"))
  return (
    <>
      <h1>{t("title-email-verified")}</h1>
      <Infobox
        tone={TONE.SUCCESS}
        className={css`
          margin-bottom: var(--space-4);
        `}
      >
        {t("message-your-email-has-been-verified")}
      </Infobox>

      <Link href="/" styledAsButton size="medium" variant="primary">
        {t("home-page")}
      </Link>
    </>
  )
}

export default withErrorBoundary(EmailVerifiedPage)
