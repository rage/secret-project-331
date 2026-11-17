"use client"

import { css } from "@emotion/css"
import React, { useEffect, useMemo } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type { CertificateDetails } from "@/generated/api/types.generated"
import { Link } from "@/shared-module/components"

export interface CertificateImageProps {
  certificateBlob: Blob
  details?: CertificateDetails | undefined
}

/** The certificate image with its content as visually hidden text, and a heading. */
const CertificateImage: React.FC<CertificateImageProps> = ({ certificateBlob, details }) => {
  const { t } = useTranslation()
  const objectUrl = useMemo(() => URL.createObjectURL(certificateBlob), [certificateBlob])

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const course = details
    ? details.course_module_name
      ? `${details.course_name} (${details.course_module_name})`
      : details.course_name
    : null

  return (
    <div>
      <h1>
        {details
          ? t("certificate-heading", { course: details.course_name })
          : t("certificate-for-completing-a-course-module")}
      </h1>
      <img
        id="certificate-image"
        alt={t("certificate-for-completing-a-course-module")}
        src={objectUrl}
        className={css`
          border: 1px solid black;
        `}
      />
      {details && (
        // Rendered but visually hidden, so it is read once as content (no aria-describedby).
        <VisuallyHidden>
          <dl id="certificate-details">
            <dt>{t("certificate-recipient")}</dt>
            <dd>{details.name_on_certificate}</dd>
            <dt>{t("certificate-course")}</dt>
            <dd>{course}</dd>
            <dt>{t("certificate-completion-date")}</dt>
            {/* The UTC date, as printed on the image. */}
            <dd>{details.completion_date.slice(0, 10)}</dd>
            {details.grade && (
              <>
                <dt>{t("grade")}</dt>
                <dd>
                  {details.grade.grade !== null && details.grade.grade !== undefined
                    ? String(details.grade.grade)
                    : details.grade.passed
                      ? t("passed")
                      : t("failed")}
                </dd>
              </>
            )}
            <dt>{t("certificate-verification-id")}</dt>
            <dd>{details.verification_id}</dd>
          </dl>
        </VisuallyHidden>
      )}
      <Link
        href={objectUrl}
        // eslint-disable-next-line i18next/no-literal-string
        download="certificate.png"
        styledAsButton
        variant="primary"
        size="medium"
      >
        {t("save-as-png")}
      </Link>
    </div>
  )
}

export default CertificateImage
