"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams, useSearchParams } from "next/navigation"
import React, { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  renderReadOnlyBlockingError,
  renderReadOnlyStaleError,
} from "@/components/queryResultErrorRenderers"
import { getCertificateByVerificationIdOptions } from "@/generated/api/@tanstack/react-query.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { Link, QueryResult } from "@/shared-module/components"

const ModuleCertificateVerification: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-validate-certificate"))
  const { certificateVerificationId } = useParams<{ certificateVerificationId: string }>()
  const searchParams = useSearchParams()
  const debug = searchParams.get("debug")
  const testCourseModuleId = searchParams.get("test_certificate_configuration_id")

  const certificate = useQuery({
    ...getCertificateByVerificationIdOptions({
      parseAs: "blob",
      path: {
        certificate_verification_id: certificateVerificationId,
      },
      query: {
        debug: !!debug,
        test_certificate_configuration_id: testCourseModuleId ?? undefined,
      },
    }),
    // This is expensive, so it doesn't make sense to retry
    retry: false,
    select: (data): Blob => {
      if (data instanceof Blob) {
        return data
      }

      throw new Error("Invalid certificate image response")
    },
  })

  return (
    <QueryResult
      query={certificate}
      renderBlockingError={renderReadOnlyBlockingError}
      renderStaleError={renderReadOnlyStaleError}
    >
      {(data) => <CertificateImage certificateBlob={data} />}
    </QueryResult>
  )
}

const CertificateImage: React.FC<{ certificateBlob: Blob }> = ({ certificateBlob }) => {
  const { t } = useTranslation()
  const objectUrl = useMemo(() => URL.createObjectURL(certificateBlob), [certificateBlob])

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  return (
    <div>
      <img
        id="certificate-image"
        alt={t("certificate-for-completing-a-course-module")}
        src={objectUrl}
        className={css`
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
      >
        {t("save-as-png")}
      </Link>
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(ModuleCertificateVerification))
