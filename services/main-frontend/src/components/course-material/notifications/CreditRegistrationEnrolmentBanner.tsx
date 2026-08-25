"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { TONE } from "@/components/credit-registration/constants"
import {
  useDismissEnrolmentBanner,
  useRequestEnrolmentRecheck,
} from "@/components/credit-registration/enrolmentActions"
import { getMyCreditRegistrationEnrolmentBannersOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { MyCreditRegistration } from "@/generated/api/types.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { completionRegistrationRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, Infobox, Link } from "@/shared-module/components"

const BANNER_TEST_ID = "credit-registration-enrolment-banner"

const bannerCss = css`
  margin: 1rem 0;
`

const bodyCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  p {
    margin: 0;
  }
`

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
`

/**
 * The student's own unresolved enrolment problems on this course, shown inside the course material.
 *
 * Renders nothing until the student has one: `no_usable_enrolment` is the only blocking state they
 * alone can clear, and it starts after the coursework is done, so there is no reason for them to
 * revisit the completion page and find out.
 */
const CreditRegistrationEnrolmentBanners: React.FC<{ courseId: string }> = ({ courseId }) => {
  const loginState = useContext(LoginStateContext)
  const query = useQuery({
    ...getMyCreditRegistrationEnrolmentBannersOptions({ path: { course_id: courseId } }),
    enabled: loginState.signedIn === true,
  })

  // Silent on failure: a nudge that could not load must not put an error box above every page of
  // the course material.
  if (!query.isSuccess) {
    return null
  }

  return (
    <>
      {query.data.map((registration) => (
        <EnrolmentBanner key={registration.id} registration={registration} />
      ))}
    </>
  )
}

const EnrolmentBanner: React.FC<{ registration: MyCreditRegistration }> = ({ registration }) => {
  const { t } = useTranslation()
  const recheck = useRequestEnrolmentRecheck()
  const dismiss = useDismissEnrolmentBanner()

  return (
    <div data-testid={BANNER_TEST_ID}>
      <Infobox
        tone={TONE.WARNING}
        heading={t("credit-registration-status-needs-enrolment")}
        className={bannerCss}
      >
        <div className={bodyCss}>
          <p>
            {t("credit-registration-needs-enrolment-for-module", {
              module: registration.course_module_name ?? registration.course_name,
            })}
          </p>
          {typeof registration.ects_credits === "number" ? (
            <p>{t("credits-n-ects", { n: registration.ects_credits })}</p>
          ) : null}
          <div className={actionsCss}>
            {registration.enrolment_link ? (
              <Link
                href={registration.enrolment_link}
                styledAsButton
                variant="primary"
                size="small"
              >
                {t("credit-registration-action-enrol")}
              </Link>
            ) : null}
            <Button
              variant="secondary"
              size="small"
              disabled={!registration.can_request_enrolment_recheck}
              isLoading={recheck.isPending}
              onClick={() => recheck.mutate(registration)}
            >
              {t("credit-registration-action-recheck-enrolment")}
            </Button>
            <Link href={completionRegistrationRoute(registration.course_module_id)}>
              {t("credit-registration-see-registration-status")}
            </Link>
            <Button
              variant="tertiary"
              size="small"
              isLoading={dismiss.isPending}
              onClick={() => dismiss.mutate(registration)}
            >
              {t("button-dismiss-notice")}
            </Button>
          </div>
        </div>
      </Infobox>
    </div>
  )
}

export default withErrorBoundary(CreditRegistrationEnrolmentBanners)
