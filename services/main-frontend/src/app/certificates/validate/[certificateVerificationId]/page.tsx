"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"

import { getCertificateByVerificationIdOptions } from "@/generated/api/@tanstack/react-query.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"

const ModuleCertificateVerification: React.FC = () => {
  const { t } = useTranslation()
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
    <>
      {certificate.isError && <ErrorBanner error={certificate.error} variant={"readOnly"} />}
      {certificate.isLoading && <Spinner variant={"medium"} />}
      {certificate.isSuccess && (
        <div>
          <img
            id="certificate-image"
            alt={t("certificate-for-completing-a-course-module")}
            src={URL.createObjectURL(certificate.data)}
            className={css`
              border: 1px solid black;
            `}
          />
          <a href={URL.createObjectURL(certificate.data)} download="certificate.png">
            <Button variant="primary" size="medium">
              {t("save-as-png")}
            </Button>
          </a>
        </div>
      )}
    </>
  )
}

export default withErrorBoundary(withSuspenseBoundary(ModuleCertificateVerification))
