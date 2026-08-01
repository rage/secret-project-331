"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { IdCard } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getMyCreditRegistrationsOptions,
  getMyCreditRegistrationsQueryKey,
  getMyVerifiedStudentNumberOptions,
  getMyVerifiedStudentNumberQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { unlinkMyStudentNumber } from "@/generated/api/sdk.generated"
import type {
  MyVerifiedStudentNumber,
  StudentNumberVerificationMethod,
} from "@/generated/api/types.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Badge, Button, DescriptionList, Infobox, QueryResult } from "@/shared-module/components"

import { TONE } from "./constants"
import LinkingEmailLine from "./LinkingEmailLine"
import SectionCard from "./SectionCard"

/**
 * How the link was proved. Worth spelling out: "our support team did this for you" is materially
 * different information from "you opened a link we mailed", and a student disputing a wrong number
 * needs to know which happened.
 */
const PROVENANCE_KEYS = {
  emailed_link: "student-number-verified-via-emailed-link",
  email_match_fast_track: "student-number-verified-via-email-match",
  admin_manual: "student-number-verified-via-admin-manual",
} as const satisfies Record<StudentNumberVerificationMethod, string>

const StudentNumberCard: React.FC = () => {
  const { t } = useTranslation()
  const linkQuery = useQuery({ ...getMyVerifiedStudentNumberOptions() })
  const registrationsQuery = useQuery({ ...getMyCreditRegistrationsOptions() })

  // The one place outside the completion status page that mentions the linking mail, and only in the
  // not-linked variant: a student who has a number is not waiting for anything.
  const linkingEmail =
    registrationsQuery.data?.find(
      (registration) =>
        registration.student_facing_status === "needs_student_number" && registration.linking_email,
    )?.linking_email ?? null

  return (
    <SectionCard icon={<IdCard size={16} />} title={t("heading-student-number")}>
      <QueryResult
        query={linkQuery}
        treatNullAsEmpty
        emptyFallback={<NotLinked linkingEmail={linkingEmail} />}
      >
        {(link) => (link ? <Linked link={link} /> : null)}
      </QueryResult>
    </SectionCard>
  )
}

const Linked: React.FC<{ link: MyVerifiedStudentNumber }> = ({ link }) => {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { confirm } = useDialog()

  const unlink = useToastMutation<void, unknown, void>(
    async () => {
      await unlinkMyStudentNumber()
    },
    { notify: true, method: "DELETE" },
    {
      onSuccess: async () => {
        // The backend moves unsent registrations back to waiting for a student number, so every
        // badge that reads the ledger is stale.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getMyVerifiedStudentNumberQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationsQueryKey() }),
        ])
      },
    },
  )

  const sisuName = [link.first_names, link.last_name].filter(Boolean).join(" ")
  const items = [
    { label: t("label-student-number"), value: link.student_number },
    ...(sisuName ? [{ label: t("label-name-in-university-records"), value: sisuName }] : []),
    {
      label: t("label-confirmed-at"),
      value: new Date(link.verified_at).toLocaleDateString(i18n.language),
    },
    {
      label: t("label-how-it-was-confirmed"),
      value: t(PROVENANCE_KEYS[link.verified_via], {
        email: link.verified_via_email_masked ?? "",
      }),
    },
  ]

  return (
    <>
      <Badge tone={TONE.SUCCESS}>{t("badge-student-number-linked")}</Badge>
      <DescriptionList items={items} />
      <p>{t("student-number-credits-registered-under-this-number")}</p>
      <Button
        variant="secondary"
        size="medium"
        isLoading={unlink.isPending}
        onClick={async () => {
          const confirmed = await confirm(
            t("confirm-remove-student-number-message"),
            t("confirm-remove-student-number-title"),
          )
          if (confirmed) {
            unlink.mutate()
          }
        }}
      >
        {t("button-remove-student-number")}
      </Button>
    </>
  )
}

const NotLinked: React.FC<{
  linkingEmail: React.ComponentProps<typeof LinkingEmailLine>["linkingEmail"]
}> = ({ linkingEmail }) => {
  const { t } = useTranslation()
  return (
    <>
      <p>{t("student-number-not-linked")}</p>
      <Infobox>{t("student-number-how-linking-works")}</Infobox>
      <LinkingEmailLine linkingEmail={linkingEmail} />
      <p>{t("student-number-cannot-read-that-address")}</p>
    </>
  )
}

export default withErrorBoundary(StudentNumberCard)
