"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { getPendingRoleCountWaitingForMeOptions } from "@/generated/api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { userSettingsRoute } from "@/shared-module/common/utils/routes"
import { Infobox, Link } from "@/shared-module/components"

const INFO_TONE = "info" as const

/**
 * Tells a signed-in user that a role granted to their email address waits for them to verify it,
 * since nothing else would tell them why the role has not appeared.
 */
const PendingRolesNotice: React.FC = () => {
  const { t } = useTranslation()
  const { signedIn } = useContext(LoginStateContext)
  const waitingCount = useQuery({
    ...getPendingRoleCountWaitingForMeOptions(),
    enabled: signedIn === true,
  })

  if (!waitingCount.data) {
    return null
  }
  return (
    <Infobox tone={INFO_TONE} heading={t("pending-roles-waiting-heading")}>
      <p>{t("pending-roles-waiting-body")}</p>
      <Link href={userSettingsRoute()}>{t("pending-roles-waiting-link")}</Link>
    </Infobox>
  )
}

export default PendingRolesNotice
