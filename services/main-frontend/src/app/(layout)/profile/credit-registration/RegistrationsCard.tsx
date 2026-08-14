"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { Graduation } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { TONE } from "@/components/credit-registration/constants"
import {
  registrationStatusLabel,
  registrationStatusState,
} from "@/components/credit-registration/creditRegistrationCopy"
import SectionCard from "@/components/credit-registration/SectionCard"
import { getMyCreditRegistrationsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { MyCreditRegistration } from "@/generated/api/types.generated"
import { completionRegistrationRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import type { TableColumn } from "@/shared-module/components"
import {
  Infobox,
  Link,
  QueryResult,
  RegistrationStatusBadge,
  Table,
} from "@/shared-module/components"

import { EM_DASH } from "../constants"

const emptyCss = css`
  margin: 0;
  color: var(--color-gray-600);
`

const supersededCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

const enrolmentPromptCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-start;

  p {
    margin: 0;
  }
`

const RegistrationsCard: React.FC = () => {
  const { t } = useTranslation()
  const query = useQuery({ ...getMyCreditRegistrationsOptions() })

  return (
    <SectionCard icon={<Graduation size={16} />} title={t("heading-my-credit-registrations")}>
      <QueryResult
        query={query}
        treatEmptyAsData
        emptyFallback={<p className={emptyCss}>{t("credit-registration-no-completions-yet")}</p>}
      >
        {(registrations) => <RegistrationsTable registrations={registrations} />}
      </QueryResult>
    </SectionCard>
  )
}

const RegistrationsTable: React.FC<{ registrations: MyCreditRegistration[] }> = ({
  registrations,
}) => {
  const { t } = useTranslation()

  const columns: TableColumn<MyCreditRegistration>[] = [
    {
      header: t("label-module"),
      cell: (registration) => (
        <>
          <Link href={completionRegistrationRoute(registration.course_module_id)}>
            {registration.course_module_name ?? registration.course_name}
          </Link>
          {/* A replaced attempt keeps its own row: the registry may hold both attainments. */}
          {registration.superseded ? (
            <div className={supersededCss}>
              {t("credit-registration-earlier-attempt", { attempt: registration.attempt_number })}
            </div>
          ) : null}
        </>
      ),
    },
    { header: t("label-course"), cell: (registration) => registration.course_name },
    {
      header: t("label-completed"),
      cell: (registration) => dateToString(registration.completion_date, false),
    },
    {
      header: t("label-ects-credits"),
      cell: (registration) => registration.ects_credits ?? EM_DASH,
    },
    {
      header: t("label-status"),
      cell: (registration) => (
        <RegistrationStatusBadge
          state={registrationStatusState(registration.student_facing_status)}
        >
          {registrationStatusLabel(t, registration.student_facing_status)}
        </RegistrationStatusBadge>
      ),
    },
  ]

  const needingEnrolment = registrations.filter(
    (registration) => registration.student_facing_status === "needs_enrolment",
  )

  return (
    <>
      {needingEnrolment.map((registration) => (
        <Infobox key={registration.id} tone={TONE.WARNING}>
          <div className={enrolmentPromptCss}>
            <p>
              {t("credit-registration-needs-enrolment-for-module", {
                module: registration.course_module_name ?? registration.course_name,
              })}
            </p>
            {registration.enrolment_link ? (
              <Link href={registration.enrolment_link}>
                {t("credit-registration-action-enrol")}
              </Link>
            ) : null}
          </div>
        </Infobox>
      ))}
      <Table
        columns={columns}
        rows={registrations}
        rowKey={(registration) => registration.id}
        caption={t("heading-my-credit-registrations")}
      />
    </>
  )
}

export default withErrorBoundary(RegistrationsCard)
