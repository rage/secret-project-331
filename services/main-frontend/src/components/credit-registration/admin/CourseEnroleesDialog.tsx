"use client"

import { useQueryClient } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { EmailAddress } from "@/components/credit-registration/EmailAddress"
import { getAccountLinkingCourseEnroleesQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import type {
  AdminCourseEnrolee,
  AdminCourseEnrolees,
  AdminResendAccountLinkingEmailResult,
} from "@/generated/api/types.generated"
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
import { candidateFullName, candidateName, withSendResult } from "./linkingCandidate"

const LINKING_SINCE = "credit-registration-admin-course-enrolees-linking-since"

interface Props extends DialogOpenState {
  courseOrTargetId: string
  courseName: string
}

interface Fields {
  filter: string
}

const searchText = (enrolee: AdminCourseEnrolee): string =>
  [
    candidateFullName(enrolee.person),
    enrolee.person.email,
    enrolee.person.student_number,
    enrolee.linked_user_email,
  ]
    .join("\n")
    .toLocaleLowerCase()

const PersonCell: React.FC<{ enrolee: AdminCourseEnrolee }> = ({ enrolee }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={stackedCellCss}>
      <span>{candidateName(t, enrolee.person)}</span>
      <span className={codeValueCss}>{enrolee.person.student_number}</span>
      {enrolee.person.email ? (
        <EmailAddress address={enrolee.person.email} />
      ) : (
        <span className={noteCss}>
          {t("credit-registration-admin-linking-candidate-no-address")}
        </span>
      )}
    </span>
  )
}

const EnrolmentCell: React.FC<{ enrolee: AdminCourseEnrolee }> = ({ enrolee }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={stackedCellCss}>
      {enrolee.person.enrolled_at ? (
        <ZonedTimestamp at={enrolee.person.enrolled_at} />
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
  if (enrolee.linking_emails_sent_at.length === 0) {
    return <span className={noteCss}>{t("credit-registration-admin-no-linking-emails-sent")}</span>
  }
  return (
    <span className={stackedCellCss}>
      {enrolee.linking_emails_sent_at.map((sentAt) => (
        <ZonedTimestamp key={sentAt} at={sentAt} />
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
  const { control, watch, reset } = useForm<Fields>({ defaultValues: { filter: "" } })
  const filter = watch("filter")
  const [sendTo, setSendTo] = useState<string | null>(null)
  const enroleesQuery = useCourseEnrolees(courseOrTargetId, isOpen)

  const enrolees = enroleesQuery.data
  const people = useMemo(() => enrolees?.people ?? [], [enrolees])
  const searchTexts = useMemo(() => people.map((enrolee) => searchText(enrolee)), [people])
  const shownPeople = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase()
    return people.filter((_, index) => searchTexts[index]?.includes(needle))
  }, [people, searchTexts, filter])

  // Patches the cached list, as reloading it would ask Sisu again.
  const recordSend = (studentNumber: string, result: AdminResendAccountLinkingEmailResult) => {
    const sentAt = result.manual_send?.sent_at
    queryClient.setQueryData<AdminCourseEnrolees>(
      getAccountLinkingCourseEnroleesQueryKey({
        path: { course_or_target_id: courseOrTargetId },
      }),
      (current) =>
        current && {
          ...current,
          people: current.people.map((enrolee) =>
            enrolee.person.student_number === studentNumber && sentAt
              ? {
                  ...enrolee,
                  person: withSendResult(enrolee.person, studentNumber, result),
                  linking_emails_sent_at: [sentAt, ...enrolee.linking_emails_sent_at],
                }
              : enrolee,
          ),
        },
    )
  }

  const closeDialog = () => {
    onClose()
    reset({ filter: "" })
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
                  onClick={() => setSendTo(enrolee.person.student_number)}
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
        {enroleesQuery.isError && (
          <Infobox tone={TONE.DANGER}>
            {t("credit-registration-admin-send-linking-email-enrolees-failed")}
          </Infobox>
        )}
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
              rowKey={(enrolee) => enrolee.person.student_number}
              rows={shownPeople}
              emptyState={t("credit-registration-admin-send-linking-email-no-match")}
              columns={columns}
            />
          </>
        )}
      </div>
      <AdminResendLinkingEmailDialog
        isOpen={sendTo !== null}
        onClose={() => setSendTo(null)}
        studentNumber={sendTo ?? ""}
        courseOrTargetId={courseOrTargetId}
        courseName={courseName}
        onSent={(result) => {
          if (sendTo !== null) {
            recordSend(sendTo, result)
          }
        }}
      />
    </Dialog>
  )
}

export default CourseEnroleesDialog
