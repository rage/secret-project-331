"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { Link } from "@/shared-module/components"

const NotFoundContent: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("not-found-title"))
  return (
    <div
      className={css`
        padding: var(--space-6) 0;
      `}
    >
      <h1>{t("not-found-title")}</h1>
      <p>{t("could-not-find-requested-resource")}</p>
      <Link href="/" styledAsButton size="medium" variant="primary">
        {t("home-page")}
      </Link>
    </div>
  )
}

export default NotFoundContent
