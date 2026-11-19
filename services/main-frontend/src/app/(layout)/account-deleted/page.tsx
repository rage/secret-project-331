"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { Infobox, Link, TONE } from "@/shared-module/components"

const AccountDeletedPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("account-deleted"))
  return (
    <>
      <h1>{t("account-deleted")}</h1>
      <Infobox
        tone={TONE.SUCCESS}
        className={css`
          margin-bottom: var(--space-4);
        `}
      >
        {t("message-your-account-has-been-deleted")}
      </Infobox>

      <Link href="/" styledAsButton size="medium" variant="primary">
        {t("home-page")}
      </Link>
    </>
  )
}

export default AccountDeletedPage
