"use client"

import { css } from "@emotion/css"
import React, { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { headingCss, pageTitleCss } from "@/components/credit-registration/styles"
import type { CertificateDetails } from "@/generated/api/types.generated"
import { certificateValidateRoute } from "@/shared-module/common/utils/routes"
import { CopyButton, DescriptionList, Link } from "@/shared-module/components"

interface CertificateImageProps {
  certificateBlob: Blob
  details?: CertificateDetails | undefined
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "long", timeZone: "UTC" }

/** The certificate image, its download link and, when details are available, a visible details list. */
const CertificateImage: React.FC<CertificateImageProps> = ({ certificateBlob, details }) => {
  const { t, i18n } = useTranslation()
  const objectUrl = useMemo(() => URL.createObjectURL(certificateBlob), [certificateBlob])

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const course = details?.course_module_name
    ? `${details.course_name} (${details.course_module_name})`
    : details?.course_name

  const grade = details?.grade
  const gradeText = grade
    ? grade.grade !== null && grade.grade !== undefined
      ? String(grade.grade)
      : grade.passed
        ? t("passed")
        : t("failed")
    : null

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
      `}
    >
      <h1 className={pageTitleCss}>
        {details
          ? t("certificate-heading", { course: details.course_name })
          : t("certificate-for-completing-a-course-module")}
      </h1>
      <img
        id="certificate-image"
        alt={details ? t("certificate-image-alt") : t("certificate-for-completing-a-course-module")}
        src={objectUrl}
        className={css`
          display: block;
          max-width: 100%;
          height: auto;
          border: 1px solid black;
        `}
      />
      <Link
        href={objectUrl}
        // eslint-disable-next-line i18next/no-literal-string
        download="certificate.png"
        styledAsButton
        variant="primary"
        size="medium"
        className={css`
          align-self: flex-start;
        `}
      >
        {t("save-as-png")}
      </Link>
      {details && (
        <>
          <h2 className={headingCss}>{t("certificate-details-heading")}</h2>
          <DescriptionList
            items={[
              { label: t("certificate-recipient"), value: details.name_on_certificate },
              { label: t("certificate-course"), value: course },
              {
                label: t("certificate-issued-date"),
                // The UTC day, as printed on the image.
                value: new Intl.DateTimeFormat(i18n.language, DATE_FORMAT).format(
                  new Date(details.completion_date),
                ),
              },
              ...(gradeText !== null ? [{ label: t("grade"), value: gradeText }] : []),
              {
                label: t("certificate-verification-id"),
                value: (
                  <>
                    <span>{details.verification_id}</span>{" "}
                    <CopyButton
                      value={`${window.location.origin}${certificateValidateRoute(details.verification_id)}`}
                      label={t("copy-certificate-link")}
                    />
                  </>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  )
}

export default CertificateImage
