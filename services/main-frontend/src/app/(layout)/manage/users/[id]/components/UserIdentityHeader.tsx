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
import {
  Avatar,
  Badge,
  CopyButton,
  DescriptionList,
  QueryResults,
  TONE,
} from "@/shared-module/components"

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
  gap: var(--space-4);
  margin-bottom: var(--space-3);
`

const tmcLinkCss = css`
  display: inline-flex;
  text-decoration: none;
  border-radius: 999px;

  &:hover {
    filter: brightness(0.96);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`

const bodyCss = css`
  flex: 1 1 auto;
  min-width: 0;
`

const nameCss = css`
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-4);
  font-weight: 700;
  color: var(--color-gray-700);
`

const chipsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-3) 0;
`

// Role/TMC chips share the chips row's flex layout, but sit inside the query frame that gates them.
const chipGroupCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
`

const verificationValueCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
`

const idValueCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
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
  const { t, i18n } = useTranslation()
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
    // An unverified address is self-service editable; support needs to see that.
    const verifiedAt = userDetails.email_verified_at
    items.splice(1, 0, {
      label: t("label-email-verification"),
      value: verifiedAt ? (
        <span className={verificationValueCss}>
          <Badge tone={TONE.SUCCESS}>{t("badge-email-verified")}</Badge>
          {new Date(verifiedAt).toLocaleString(i18n.language)}
        </span>
      ) : (
        <Badge tone={TONE.NEUTRAL}>{t("badge-email-not-verified")}</Badge>
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
