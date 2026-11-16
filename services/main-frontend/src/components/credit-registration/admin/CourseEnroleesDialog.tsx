"use client"

import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { EmailAddress } from "@/components/credit-registration/EmailAddress"
import { getAccountLinkingCourseEnroleesQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import type {
  AdminCourseEnrolee,
  AdminCourseEnrolees,
  AdminResendAccountLinkingEmailResult,
} from "@/generated/api/types.generated"
import { isAppApiError } from "@/shared-module/common/errors/AppApiError"
import { creditRegistrationItemRoute, manageUserRoute } from "@/shared-module/common/utils/routes"
import type { TableColumn } from "@/shared-module/components"
import { Badge, Button, Dialog, Infobox, Link, Table, TextField } from "@/shared-module/components"

import {
  BADGE_COMPACT,
  BUTTON_SECONDARY,
  BUTTON_SMALL,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  ID_PREFIX_LENGTH,
  TABLE_STACK,
  TONE,
} from "../constants"
import { codeValueCss, dialogFormCss, noteCss, proseCss, stackedCellCss } from "../styles"
import { useIsAccountLinkingEnabled } from "../useIsAccountLinkingEnabled"
import { sentenceWithTimestamp, ZonedTimestamp } from "../ZonedTimestamp"
import type { DialogOpenState } from "./AdminActionDialog"
import { useCourseEnrolees } from "./adminCreditRegistrationHooks"
import AdminResendLinkingEmailDialog from "./AdminResendLinkingEmailDialog"
import { candidateFullName, candidateName } from "./linkingCandidate"
import LinkingEmailSendStatus from "./LinkingEmailSendStatus"
import { useFilteredPeople } from "./useFilteredPeople"

const LINKING_SINCE = "credit-registration-admin-course-enrolees-linking-since"

interface Props extends DialogOpenState {
  courseOrTargetId: string
  courseName: string
}

const NO_ENROLEES: AdminCourseEnrolee[] = []

const searchText = (enrolee: AdminCourseEnrolee): string =>
  [
    candidateFullName(enrolee),
    enrolee.primary_email,
    enrolee.secondary_email,
    enrolee.student_number,
    enrolee.linked_user_email,
  ].join("\n")

const SisuAddress: React.FC<{ label: string; address: string | null | undefined }> = ({
  label,
  address,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={noteCss}>
      {label}:{" "}
      {address ? (
        <EmailAddress address={address} />
      ) : (
        t("credit-registration-admin-sisu-email-none")
      )}
    </span>
  )
}

const PersonCell: React.FC<{ enrolee: AdminCourseEnrolee }> = ({ enrolee }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={stackedCellCss}>
      <span>{candidateName(t, enrolee)}</span>
      <span className={codeValueCss}>{enrolee.student_number}</span>
      <SisuAddress
        label={t("credit-registration-admin-sisu-primary-email")}
        address={enrolee.primary_email}
      />
      <SisuAddress
        label={t("credit-registration-admin-sisu-secondary-email")}
        address={enrolee.secondary_email}
      />
    </span>
  )
}

const EnrolmentCell: React.FC<{ enrolee: AdminCourseEnrolee }> = ({ enrolee }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={stackedCellCss}>
      {enrolee.enrolled_at ? (
        <ZonedTimestamp at={enrolee.enrolled_at} />
      ) : (
        <span className={noteCss}>
          {t("credit-registration-admin-linking-candidate-enrolment-time-unknown")}
        </span>
      )}
      {enrolee.enrolment_state && (
        <span className={noteCss}>
          <code className={codeValueCss}>{enrolee.enrolment_state}</code>
        </span>
      )}
    </span>
  )
}

const AccountCell: React.FC<{ enrolee: AdminCourseEnrolee }> = ({ enrolee }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (!enrolee.linked_user_id) {
    return (
      <span className={stackedCellCss}>
        <span>{t("credit-registration-admin-not-linked")}</span>
        {enrolee.enrolled_before_account_linking && (
          <Badge tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
            {t("credit-registration-admin-enrolled-before-account-linking")}
          </Badge>
        )}
      </span>
    )
  }
  return (
    <Link
      href={
        enrolee.credit_registration_id
          ? creditRegistrationItemRoute(enrolee.credit_registration_id)
          : manageUserRoute(enrolee.linked_user_id)
      }
      prefetch={false}
    >
      {enrolee.linked_user_email ?? enrolee.linked_user_id.slice(0, ID_PREFIX_LENGTH)}
    </Link>
  )
}

const LinkingEmailsCell: React.FC<{ enrolee: AdminCourseEnrolee }> = ({ enrolee }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (enrolee.linking_emails.length === 0) {
    return <span className={noteCss}>{t("credit-registration-admin-no-linking-emails-sent")}</span>
  }
  return (
    <span className={stackedCellCss}>
      {enrolee.linking_emails.map((email) => (
        <span key={email.claimed_at} className={stackedCellCss}>
          <ZonedTimestamp at={email.claimed_at} />
          <LinkingEmailSendStatus report={email.send_status} />
        </span>
      ))}
    </span>
  )
}

/**
 * Everyone on a course's or mooc.fi target's Sisu enrolment lists, loaded live while open, with the
 * account each is linked to and the linking emails they have had.
 */
const CourseEnroleesDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  courseOrTargetId,
  courseName,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const canSend = useIsAccountLinkingEnabled()
  const [sendTo, setSendTo] = useState<string | null>(null)
  const enroleesQuery = useCourseEnrolees(courseOrTargetId, isOpen)
  const enroleesQueryKey = getAccountLinkingCourseEnroleesQueryKey({
    path: { course_or_target_id: courseOrTargetId },
  })

  const enrolees = enroleesQuery.data
  const people = enrolees?.people ?? NO_ENROLEES
  const { control, shown: shownPeople, reset: resetFilter } = useFilteredPeople(people, searchText)

  // Patches the cached list, as reloading it would ask Sisu again.
  const recordSend = (studentNumber: string, result: AdminResendAccountLinkingEmailResult) => {
    const sentAt = result.manual_send?.sent_at
    queryClient.setQueryData<AdminCourseEnrolees>(
      enroleesQueryKey,
      (current) =>
        current && {
          ...current,
          people: current.people.map((enrolee) =>
            enrolee.student_number === studentNumber && sentAt
              ? {
                  ...enrolee,
                  linking_emails: [
                    { claimed_at: sentAt, send_status: null },
                    ...enrolee.linking_emails,
                  ],
                }
              : enrolee,
          ),
        },
    )
  }

  const closeDialog = () => {
    onClose()
    resetFilter()
    // The next open asks Sisu again, and must not show this list as current meanwhile.
    queryClient.removeQueries({ queryKey: enroleesQueryKey })
  }

  const columns: TableColumn<AdminCourseEnrolee>[] = [
    {
      header: t("label-student"),
      grow: true,
      minWidth: "12rem",
      cell: (enrolee) => <PersonCell enrolee={enrolee} />,
    },
    {
      header: t("credit-registration-admin-column-sisu-enrolment"),
      minWidth: "9rem",
      cell: (enrolee) => <EnrolmentCell enrolee={enrolee} />,
    },
    {
      header: t("credit-registration-admin-column-account"),
      minWidth: "10rem",
      cell: (enrolee) => <AccountCell enrolee={enrolee} />,
    },
    {
      header: t("credit-registration-tab-linking-emails"),
      minWidth: "9rem",
      cell: (enrolee) => <LinkingEmailsCell enrolee={enrolee} />,
    },
    ...(canSend
      ? [
          {
            header: t("label-actions"),
            minWidth: "8rem",
            cell: (enrolee: AdminCourseEnrolee) =>
              enrolee.linked_user_id ? null : (
                <Button
                  variant={BUTTON_SECONDARY}
                  size={BUTTON_SMALL}
                  onClick={() => setSendTo(enrolee.student_number)}
                >
                  {t("button-text-send-linking-email")}
                </Button>
              ),
          },
        ]
      : []),
  ]

  return (
    <Dialog
      open={isOpen}
      onClose={closeDialog}
      size="wide"
      title={t("credit-registration-admin-course-enrolees-title")}
    >
      <div className={dialogFormCss}>
        <p className={proseCss}>
          {t("credit-registration-admin-course-enrolees-intro", { course: courseName })}
        </p>
        {enrolees?.account_linking_since && (
          <p className={proseCss}>
            {sentenceWithTimestamp(t, LINKING_SINCE, enrolees.account_linking_since)}
          </p>
        )}
        {enroleesQuery.isError &&
          (isAppApiError(enroleesQuery.error) && enroleesQuery.error.status === 400 ? (
            <p className={proseCss}>
              {t("credit-registration-admin-course-enrolees-no-course-codes")}
            </p>
          ) : (
            <Infobox tone={TONE.DANGER}>
              {t("credit-registration-admin-send-linking-email-enrolees-failed")}
            </Infobox>
          ))}
        {enroleesQuery.isPending && (
          <p className={noteCss}>{t("credit-registration-admin-linking-candidates-loading")}</p>
        )}
        {enrolees?.study_registry_unavailable && (
          <Infobox tone={TONE.WARNING}>
            {t("credit-registration-admin-linking-candidates-unavailable")}
          </Infobox>
        )}
        {enrolees && !enrolees.study_registry_unavailable && people.length === 0 && (
          <p className={proseCss}>{t("credit-registration-admin-course-enrolees-none")}</p>
        )}
        {people.length > 0 && (
          <>
            <TextField
              name="filter"
              control={control}
              label={t("credit-registration-admin-send-linking-email-filter-label")}
              description={t("credit-registration-admin-send-linking-email-filter-description")}
            />
            <Table
              caption={t("credit-registration-admin-course-enrolees-title")}
              density={DENSITY_COMPACT}
              responsive={TABLE_STACK}
              rowKey={(enrolee) => enrolee.student_number}
              rows={shownPeople}
              emptyState={t("credit-registration-admin-send-linking-email-no-match")}
              columns={columns}
            />
          </>
        )}
      </div>
      {sendTo !== null && (
        <AdminResendLinkingEmailDialog
          isOpen
          onClose={() => setSendTo(null)}
          studentNumber={sendTo}
          courseOrTargetId={courseOrTargetId}
          courseName={courseName}
          onSent={(result) => recordSend(sendTo, result)}
        />
      )}
    </Dialog>
  )
}

export default CourseEnroleesDialog
