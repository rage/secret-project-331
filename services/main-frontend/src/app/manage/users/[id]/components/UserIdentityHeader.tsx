"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import DeletedUserNotice from "@/components/DeletedUserNotice"
import { USER_ROLES } from "@/constants/roles"
import {
  getUserOptions,
  getUserRolesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { UserDetail, UserRole } from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { baseTheme } from "@/shared-module/common/styles"
import {
  Avatar,
  Badge,
  CopyButton,
  DescriptionList,
  QueryResults,
} from "@/shared-module/components"

import { TONE } from "../lib/displayConstants"

export interface UserIdentityHeaderProps {
  userId: string
  userDetails: UserDetail | null
  userDetailsNotFound: boolean
}

// The student's TMC (mooc.fi) participant page; the account's upstream_id is the participant id.
const TMC_PARTICIPANT_URL = "https://tmc.mooc.fi/participants/"

const headerCss = css`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin: 1rem 0 0.5rem;
`

const tmcLinkCss = css`
  display: inline-flex;
  text-decoration: none;
  border-radius: 999px;

  &:hover {
    filter: brightness(0.96);
  }

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.blue[400]};
    outline-offset: 1px;
  }
`

const bodyCss = css`
  flex: 1 1 auto;
  min-width: 0;
`

const nameCss = css`
  margin: 0 0 0.4rem;
  font-size: 1.6rem;
  font-weight: 700;
  color: ${baseTheme.colors.gray[700]};
`

const chipsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.6rem 0;
`

// Role/TMC chips share the chips row's flex layout, but sit inside the query frame that gates them.
const chipGroupCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
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

  const displayName = formatUserName(userDetails) || userDetails?.email || t("header-user-details")

  // Enum role → its localized label; the raw enum value is never shown.
  const roleLabel = (role: UserRole): string => {
    const match = USER_ROLES.find((r) => r.value === role)
    return match ? t(match.translationKey) : role
  }

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
            {/* Roles and TMC id are separate fetches: show their load/error state instead of silently
                deriving from empty defaults. The identity above stays visible regardless. */}
            <QueryResults
              queries={[rolesQuery, userQuery] as const}
              treatEmptyAsData
              renderData={([roles, user]) => {
                const distinctRoles = Array.from(new Set(roles.map((r) => r.role)))
                const tmcId = user.upstream_id ?? null
                return (
                  <div className={chipGroupCss}>
                    {distinctRoles.map((role) => (
                      <Badge key={role} tone={TONE.INFO}>
                        {roleLabel(role)}
                      </Badge>
                    ))}
                    {tmcId !== null ? (
                      <a
                        className={tmcLinkCss}
                        href={`${TMC_PARTICIPANT_URL}${tmcId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Badge tone={TONE.NEUTRAL}>{t("tmc-id", { id: tmcId })}</Badge>
                      </a>
                    ) : null}
                  </div>
                )
              }}
            />
          </div>
          <DescriptionList items={items} />
        </div>
      </div>
      {userDetailsNotFound ? <DeletedUserNotice userId={userId} /> : null}
    </div>
  )
}

export default UserIdentityHeader
