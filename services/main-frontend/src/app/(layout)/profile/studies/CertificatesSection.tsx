"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { MIDDLE_DOT } from "@/components/credit-registration/constants"
import {
  dividedListCss,
  headingCss,
  noteCss,
  rowCss,
  sectionCss,
} from "@/components/credit-registration/styles"
import { getMyCertificatesOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { UserCertificate } from "@/generated/api/types.generated"
import { certificateValidateRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult } from "@/shared-module/components"

const itemCss = cx(
  rowCss,
  css`
    justify-content: space-between;
  `,
)

const titleCss = css`
  font-weight: 500;
  color: var(--color-gray-700);
`

/**
 * The student's certificates, listed only once they hold one.
 *
 * Its own query and error boundary so a failure here cannot blank the study record beside it. No
 * empty state: a heading over "you have none" tells a student nothing they did not know.
 */
const CertificatesSection: React.FC = () => {
  const query = useQuery({ ...getMyCertificatesOptions() })

  return (
    // No `emptyFallback`: its default renders nothing, which is the empty state this section wants.
    <QueryResult query={query}>
      {(certificates) => <CertificatesList certificates={certificates} />}
    </QueryResult>
  )
}

export const CertificatesList: React.FC<{ certificates: UserCertificate[] }> = ({
  certificates,
}) => {
  const { t } = useTranslation()

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("heading-your-certificates")}</h2>
      <ul className={dividedListCss}>
        {certificates.map((certificate) => (
          <li key={certificate.id} className={itemCss}>
            <div>
              <div className={titleCss}>
                {certificate.course_module_name ?? certificate.course_name}
              </div>
              <div className={noteCss}>
                {certificate.course_module_name ? (
                  <>
                    {certificate.course_name}
                    {MIDDLE_DOT}
                  </>
                ) : null}
                {/* The name is fixed at generation time, so a typo is only ever noticed here. */}
                {t("certificate-issued-to-name-on-date", {
                  name: certificate.name_on_certificate,
                  date: dateToString(certificate.created_at, false),
                })}
              </div>
            </div>
            <Link
              href={certificateValidateRoute(certificate.verification_id)}
              styledAsButton
              variant="secondary"
              size="small"
            >
              {t("view_certificate")}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default withErrorBoundary(CertificatesSection)
