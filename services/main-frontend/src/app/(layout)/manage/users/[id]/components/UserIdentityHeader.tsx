"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS, TONE } from "@/components/credit-registration/constants"
import { monospaceCss, noteCss, pageTitleCss } from "@/components/credit-registration/styles"
import {
  linkingEmailSentence,
  studentNumberVerificationLabel,
} from "@/components/credit-registration/teacherCreditRegistrations"
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
  type DescriptionListItem,
  QueryResults,
} from "@/shared-module/components"

import type { StudentNumberState } from "../lib/creditRegistrations"

export interface UserIdentityHeaderProps {
  userId: string
  userDetails: UserDetail | null
  userDetailsNotFound: boolean
  /** Null when no registration knows of a student number, or the viewer may not read one. */
  studentNumber: StudentNumberState | null
}

// The student's TMC (mooc.fi) participant page; the account's upstream_id is the participant id.
const TMC_PARTICIPANT_URL = "https://tmc.mooc.fi/participants/"

const headerCss = css`
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
  min-width: 0;
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

// A user with no name falls back to their email, which has no spaces to wrap at.
const nameCss = css`
  margin: 0 0 var(--space-2) 0;
  overflow-wrap: anywhere;
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

const emailValueCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  min-width: 0;
  overflow-wrap: anywhere;
`

const idButtonRowCss = css`
  margin-top: var(--space-3);
`

// CopyButton's default chrome is a bordered chip, which reads as a Badge once it carries a text
// label rather than just its glyph.
const quietCopyButtonCss = css`
  border: none;
  background: none;
`

/** The number the credits are registered under, or what we last did about getting one confirmed. */
const StudentNumberValue: React.FC<{ state: StudentNumberState }> = ({ state }) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)

  if (state.studentNumber) {
    const provenance = studentNumberVerificationLabel(t, state.verifiedVia)
    return (
      <span className={emailValueCss}>
        <span className={monospaceCss}>{state.studentNumber}</span>
        {/* No leading dot: this can wrap onto its own line, stranding one at the front. */}
        {provenance ? <span className={noteCss}>{provenance}</span> : null}
      </span>
    )
  }

  const linkingEmail = state.linkingEmail
  return (
    <span className={emailValueCss}>
      <Badge tone={TONE.NEUTRAL}>{t("badge-student-number-not-linked")}</Badge>
      {linkingEmail ? (
        <span className={noteCss}>
          {linkingEmailSentence(
            t,
            linkingEmail.email_send_status,
            linkingEmail.sent_at,
            linkingEmail.emailed_to_masked,
            i18n.language,
          )}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Identity block: monogram, name, the email with its verification note, the student number the
 * credits go under, and the account chips (roles, TMC id).
 */
const UserIdentityHeader: React.FC<UserIdentityHeaderProps> = ({
  userId,
  userDetails,
  userDetailsNotFound,
  studentNumber,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const rolesQuery = useQuery({ ...getUserRolesOptions({ path: { user_id: userId } }) })
  const userQuery = useQuery({ ...getUserOptions({ path: { user_id: userId } }) })

  const displayName = formatUserName(userDetails) || userDetails?.email || t("header-user-details")

  // Enum role → its localized label; the raw enum value is never shown.
  const roleLabel = (role: UserRole): string => {
    const match = USER_ROLES.find((r) => r.value === role)
    return match ? t(match.translationKey) : role
  }

  const items: DescriptionListItem[] = []
  if (!userDetailsNotFound && userDetails?.email) {
    // An unverified address is self-service editable, so support needs to see it — but it does not
    // block credit registration, which links through the university's own address instead.
    const verifiedAt = userDetails.email_verified_at
    items.push({
      label: t("label-email"),
      value: (
        <span className={emailValueCss}>
          {userDetails.email}
          <CopyButton value={userDetails.email} label={t("copy-email")} />
          <Badge tone={verifiedAt ? TONE.SUCCESS : TONE.NEUTRAL}>
            {verifiedAt
              ? t("email-verified-on", {
                  date: new Date(verifiedAt).toLocaleString(i18n.language),
                })
              : t("email-not-verified")}
          </Badge>
        </span>
      ),
    })
  }
  if (studentNumber) {
    items.push({
      label: t("label-student-number"),
      value: <StudentNumberValue state={studentNumber} />,
    })
  }

  return (
    <div>
      <div className={headerCss}>
        <Avatar name={displayName} size={56} />
        <div className={bodyCss}>
          <h1 className={cx(pageTitleCss, nameCss)}>{displayName}</h1>
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
          {items.length > 0 ? <DescriptionList items={items} /> : null}
          <div className={idButtonRowCss}>
            <CopyButton value={userId} label={t("copy-user-id")} className={quietCopyButtonCss}>
              {t("copy-user-id")}
            </CopyButton>
          </div>
        </div>
      </div>
      {userDetailsNotFound ? <DeletedUserNotice userId={userId} /> : null}
    </div>
  )
}

export default UserIdentityHeader
