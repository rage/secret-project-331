"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"

import { fetchCertificateImage } from "@/services/backend/certificates"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ModuleCertificateVerification: React.FC = () => {
  const { t } = useTranslation()
  const { certificateVerificationId } = useParams<{ certificateVerificationId: string }>()
  const searchParams = useSearchParams()
  const debug = searchParams.get("debug")
  const testCourseModuleId = searchParams.get("test_certificate_configuration_id")
  const testCourseInstanceId = searchParams.get("test_course_instance_id")

  const certificate = useQuery({
    queryKey: [
      "certificate-image",
      certificateVerificationId,
      debug,
      testCourseModuleId,
      testCourseInstanceId,
    ],
    queryFn: async () =>
      fetchCertificateImage(
        certificateVerificationId,
        !!debug,
        testCourseModuleId ?? undefined,
        testCourseInstanceId ?? undefined,
      ),
    // This is expensive, so it doesn't make sense to retry
    retry: false,
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

export default withErrorBoundary(ModuleCertificateVerification)
