"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { AuthCard, AuthCardFooterLink } from "@/components/auth/AuthCard"
import { RESET_LINK_LIFETIME_HOURS } from "@/components/auth/passwordReset"
import { loginRoute } from "@/shared-module/common/utils/routes"
import { Link } from "@/shared-module/components"

interface ResetLinkInvalidCardProps {
  headingRef?: React.Ref<HTMLHeadingElement> | undefined
}

/** Shown for a password reset link that is expired, already used, superseded or malformed. */
const ResetLinkInvalidCard: React.FC<ResetLinkInvalidCardProps> = ({ headingRef }) => {
  const { t } = useTranslation()

  return (
    <AuthCard
      headingRef={headingRef}
      title={t("reset-link-invalid-title")}
      // oxlint-disable-next-line i18next/no-literal-string -- AuthCard enum value
      statusIcon="warning"
      lede={t("reset-link-invalid-description", { count: RESET_LINK_LIFETIME_HOURS })}
      footer={
        <AuthCardFooterLink prompt={t("remembered-your-password")} href={loginRoute("/")}>
          {t("login")}
        </AuthCardFooterLink>
      }
    >
      {/* oxlint-disable-next-line i18next/no-literal-string -- route */}
      <Link href="/reset-password" styledAsButton variant="primary" isFullWidth>
        {t("request-new-reset-link")}
      </Link>
    </AuthCard>
  )
}

export default ResetLinkInvalidCard
