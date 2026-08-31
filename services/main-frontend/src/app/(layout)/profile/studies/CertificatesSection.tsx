"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { MIDDLE_DOT } from "@/components/credit-registration/constants"
import { getMyCertificatesOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { UserCertificate } from "@/generated/api/types.generated"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { certificateValidateRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult } from "@/shared-module/components"

const headingCss = css`
  font-size: 1.125rem;
  font-weight: ${fontWeights.semibold};
  color: ${baseTheme.colors.gray[700]};
  margin: 1.5rem 0 0.75rem;
`

const listCss = css`
  list-style: none;
  margin: 0;
  padding: 0;
`

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid ${baseTheme.colors.clear[300]};

  &:last-of-type {
    border-bottom: none;
  }
`

const titleCss = css`
  font-weight: ${fontWeights.medium};
  color: ${baseTheme.colors.gray[700]};
`

const metaCss = css`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.9rem;
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
    <section>
      <h2 className={headingCss}>{t("heading-your-certificates")}</h2>
      <ul className={listCss}>
        {certificates.map((certificate) => (
          <li key={certificate.id} className={rowCss}>
            <div>
              <div className={titleCss}>
                {certificate.course_module_name ?? certificate.course_name}
              </div>
              <div className={metaCss}>
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
