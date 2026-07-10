"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { TONE } from "../lib/displayConstants"

import DeletedUserNotice from "@/components/DeletedUserNotice"
import {
  getUserOptions,
  getUserRolesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { UserDetail } from "@/generated/api/types.generated"
import { Avatar, Badge, CopyButton, DescriptionList } from "@/shared-module/components"

export interface UserIdentityHeaderProps {
  userId: string
  userDetails: UserDetail | null
  userDetailsNotFound: boolean
}

const headerCss = css`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin: 1rem 0 0.5rem;
`

const bodyCss = css`
  flex: 1 1 auto;
  min-width: 0;
`

const nameCss = css`
  margin: 0 0 0.4rem;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-gray-700, #1a2333);
`

const chipsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.6rem 0;
`

const idValueCss = css`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
`

const CopyableValue: React.FC<{ display: string; value: string; copyLabel: string }> = ({
  display,
  value,
  copyLabel,
}) => (
  <span className={idValueCss}>
    {display}
    <CopyButton value={value} label={copyLabel} />
  </span>
)

/** Identity block: monogram, name, copyable email/ID, and account chips (roles, age, TMC id). */
const UserIdentityHeader: React.FC<UserIdentityHeaderProps> = ({
  userId,
  userDetails,
  userDetailsNotFound,
}) => {
  const { t } = useTranslation()
  const rolesQuery = useQuery({ ...getUserRolesOptions({ path: { user_id: userId } }) })
  const userQuery = useQuery({ ...getUserOptions({ path: { user_id: userId } }) })

  const name = `${userDetails?.first_name ?? ""} ${userDetails?.last_name ?? ""}`.trim()
  const displayName = name || userDetails?.email || t("header-user-details")

  const distinctRoles = Array.from(new Set((rolesQuery.data ?? []).map((r) => r.role)))
  const tmcId = userQuery.data?.upstream_id ?? null

  const items = [
    {
      label: t("label-user-id"),
      value: <CopyableValue display={userId} value={userId} copyLabel={t("copy-user-id")} />,
    },
  ]
  if (!userDetailsNotFound && userDetails?.email) {
    items.unshift({
      label: t("label-email"),
      value: (
        <CopyableValue
          display={userDetails.email}
          value={userDetails.email}
          copyLabel={t("copy-email")}
        />
      ),
    })
  }

  return (
    <div>
      <div className={headerCss}>
        <Avatar name={displayName} size={56} />
        <div className={bodyCss}>
          <h1 className={nameCss}>{displayName}</h1>
          <div className={chipsCss}>
            {userDetailsNotFound ? (
              <Badge tone={TONE.DANGER}>{t("badge-deleted-user")}</Badge>
            ) : null}
            {distinctRoles.map((role) => (
              <Badge key={role} tone={TONE.INFO}>
                {role}
              </Badge>
            ))}
            {tmcId !== null ? (
              <Badge tone={TONE.NEUTRAL}>{t("tmc-id", { id: tmcId })}</Badge>
            ) : null}
          </div>
          <DescriptionList items={items} />
        </div>
      </div>
      {userDetailsNotFound ? <DeletedUserNotice userId={userId} /> : null}
    </div>
  )
}

export default UserIdentityHeader
