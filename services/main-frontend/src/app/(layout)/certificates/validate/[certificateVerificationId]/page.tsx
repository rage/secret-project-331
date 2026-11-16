"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useSearchParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  renderReadOnlyBlockingError,
  renderReadOnlyStaleError,
} from "@/components/queryResultErrorRenderers"
import {
  getCertificateByVerificationIdOptions,
  getCertificateDetailsByVerificationIdOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { includeIf } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { QueryResult } from "@/shared-module/components"

import CertificateImage from "./CertificateImage"

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
        ...includeIf(testCourseModuleId !== null, {
          test_certificate_configuration_id: testCourseModuleId,
        }),
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

  // Optional: the image still shows when the text is unavailable (previews, debug).
  const details = useQuery({
    ...getCertificateDetailsByVerificationIdOptions({
      path: {
        certificate_verification_id: certificateVerificationId,
      },
    }),
    enabled: !debug && testCourseModuleId === null,
    retry: false,
    // A certificate's text does not change while the page is open.
    staleTime: Infinity,
  })

  return (
    <QueryResult
      query={certificate}
      renderBlockingError={renderReadOnlyBlockingError}
      renderStaleError={renderReadOnlyStaleError}
    >
      {(data) => <CertificateImage certificateBlob={data} details={details.data} />}
    </QueryResult>
  )
}

export default withErrorBoundary(withSuspenseBoundary(ModuleCertificateVerification))
