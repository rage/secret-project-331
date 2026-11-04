"use client"

import { css, cx } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  getMyCreditRegistrationsOptions,
  getMyCreditRegistrationsQueryKey,
  getMyStudiesOptions,
  getMyVerifiedStudentNumberOptions,
  getMyVerifiedStudentNumberQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { unlinkMyStudentNumber } from "@/generated/api/sdk.generated"
import type {
  LinkingEmailStatus,
  MyVerifiedStudentNumber,
  StudentNumberVerificationMethod,
} from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { profileStudiesRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  Badge,
  Button,
  ConfirmDialog,
  DescriptionList,
  Link,
  QueryResult,
} from "@/shared-module/components"
import { settingsCardCss } from "@/styles/sharedStyles"

import { BUTTON_TERTIARY, CREDIT_REGISTRATION_NS, TONE } from "./constants"
import { LinkingEmailLine, sentLinkingEmail } from "./EmailStatusLine"
import {
  headingCss,
  sectionCss,
  sectionHeaderCss,
  stepsCss,
  studentNumberCss,
  subheadingCss,
} from "./styles"
import { useAccountLinkingSetting } from "./useIsAccountLinkingEnabled"

/** A student disputing a wrong number needs to know how the link was proved. */
const PROVENANCE_VALUE_KEYS = {
  emailed_link: "student-number-confirmed-by-emailed-link",
  admin_manual: "student-number-confirmed-by-admin-manual",
  study_registry: "student-number-confirmed-by-study-registry",
} as const satisfies Record<StudentNumberVerificationMethod, string>

/** Separates the destructive action from the provenance above it by weight, not just position. */
const dangerZoneCss = css`
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-clear-300);
`

export interface StudentNumberCardProps {
  /** False where the card already sits on the studies page the link would lead to. */
  showStudiesLink?: boolean
}

/** The account's University of Helsinki student number: what it is, or how one gets linked. */
const StudentNumberCard: React.FC<StudentNumberCardProps> = ({ showStudiesLink = true }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useAccountLinkingSetting()
  const linkQuery = useQuery({ ...getMyVerifiedStudentNumberOptions() })
  const registrationsQuery = useQuery({ ...getMyCreditRegistrationsOptions() })
  const myStudiesQuery = useQuery({ ...getMyStudiesOptions() })
  // Unknown while myStudiesQuery is still loading: default to the has-a-registering-course
  // wording rather than flash the "none of your courses register credits" line before that is
  // known to be true.
  const hasRegisteringCourse =
    myStudiesQuery.data?.any_module_supports_credit_registration !== false

  const linkingEmail =
    registrationsQuery.data?.find(
      (registration) =>
        registration.student_facing_status === "needs_student_number" && registration.linking_email,
    )?.linking_email ?? null

  return (
    <section className={cx(sectionCss, settingsCardCss)}>
      <h2 className={headingCss}>{t("heading-university-of-helsinki-student-number")}</h2>
      <QueryResult
        query={linkQuery}
        treatNullAsEmpty
        contentClassName={sectionCss}
        emptyFallback={
          <NotLinked
            linkingEmail={linkingEmail}
            isAccountLinkingEnabled={isAccountLinkingEnabled}
          />
        }
      >
        {(link) =>
          link ? (
            <Linked
              link={link}
              hasRegisteringCourse={hasRegisteringCourse}
              showStudiesLink={showStudiesLink}
              isAccountLinkingEnabled={isAccountLinkingEnabled === true}
            />
          ) : null
        }
      </QueryResult>
    </section>
  )
}

const Linked: React.FC<{
  link: MyVerifiedStudentNumber
  hasRegisteringCourse: boolean
  showStudiesLink: boolean
  isAccountLinkingEnabled: boolean
}> = ({ link, hasRegisteringCourse, showStudiesLink, isAccountLinkingEnabled }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)

  const unlink = useToastMutation<void, unknown, void>(
    async () => {
      await unlinkMyStudentNumber()
    },
    { notify: true, method: "DELETE" },
    {
      onSuccess: async () => {
        // Unlinking moves unsent registrations back to waiting for a student number.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getMyVerifiedStudentNumberQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationsQueryKey() }),
        ])
      },
    },
  )

  const items = [
    {
      label: t("label-confirmed-on"),
      value: dateToString(link.verified_at),
    },
    {
      label: t("label-confirmed-by"),
      value: t(PROVENANCE_VALUE_KEYS[link.verified_via]),
    },
  ]

  return (
    <>
      <div className={sectionHeaderCss}>
        <span className={studentNumberCss}>{link.student_number}</span>
      </div>
      <DescriptionList items={items} />
      {hasRegisteringCourse ? (
        <p>
          {t("student-number-credits-registered-under-this-number")}
          {showStudiesLink ? (
            <>
              {" "}
              <Link href={profileStudiesRoute()}>{t("link-text-see-my-credits")}</Link>
            </>
          ) : null}
        </p>
      ) : (
        <p>{t("student-number-no-registering-courses")}</p>
      )}
      <div className={dangerZoneCss}>
        <h3 className={subheadingCss}>{t("heading-wrong-number")}</h3>
        <div>
          <Button
            variant={BUTTON_TERTIARY}
            size="small"
            isLoading={unlink.isPending}
            onClick={() => setIsRemoveDialogOpen(true)}
          >
            {t("button-remove-student-number")}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={isRemoveDialogOpen}
        onClose={() => setIsRemoveDialogOpen(false)}
        title={t("confirm-remove-student-number-title")}
        description={
          // Without linking mails a removed number comes back only when support links it again.
          isAccountLinkingEnabled
            ? t("confirm-remove-student-number-message")
            : t("confirm-remove-student-number-message-support-links-it")
        }
        confirmLabel={t("button-remove-student-number")}
        isDestructive
        onConfirm={async () => {
          await unlink.mutateAsync()
          setIsRemoveDialogOpen(false)
        }}
      />
    </>
  )
}

/** No number linked: how one gets linked, since nothing on this page can start it. */
const NotLinked: React.FC<{
  linkingEmail: LinkingEmailStatus | null
  isAccountLinkingEnabled: boolean | undefined
}> = ({ linkingEmail, isAccountLinkingEnabled }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const sent = sentLinkingEmail(linkingEmail)

  return (
    <>
      <div>
        <Badge tone={TONE.NEUTRAL}>{t("badge-student-number-not-linked")}</Badge>
      </div>
      <p>{t("student-number-not-linked")}</p>
      {/* A link already sent still works while linking is off; only new ones are not sent. */}
      {sent ? (
        <ol className={stepsCss}>
          <li>
            {t("credit-registration-student-number-step-open-the-emailed-link", {
              email: sent.emailMasked,
              date: dateToString(sent.sentAt),
            })}
          </li>
          <li>{t("credit-registration-student-number-step-stay-logged-in")}</li>
        </ol>
      ) : (
        <>
          {isAccountLinkingEnabled !== undefined && (
            <p>
              {isAccountLinkingEnabled
                ? t("student-number-linked-after-enrolment-by-email")
                : t("student-number-linked-by-support")}
            </p>
          )}
          <LinkingEmailLine linkingEmail={linkingEmail} />
        </>
      )}
    </>
  )
}

export default withErrorBoundary(StudentNumberCard)
