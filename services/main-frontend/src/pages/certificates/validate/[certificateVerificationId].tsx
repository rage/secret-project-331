import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { fetchCertificateImage } from "../../../services/backend/certificates"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<string>
}

const ModuleCertificateVerification: React.FC<React.PropsWithChildren<Props>> = ({ query }) => {
  const { t } = useTranslation()
  const certificateVerificationId = query.certificateVerificationId
  const debug = query.debug
  const testCourseModuleId = query.test_certificate_configuration_id
  const testCourseInstanceId = query.test_course_instance_id

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
        testCourseModuleId,
        testCourseInstanceId,
      ),
    // This is expensive, so it doesn't make sense to retry
    retry: false,
  })
  return (
    <>
      {certificate.isError && <ErrorBanner error={certificate.error} variant={"readOnly"} />}
      {certificate.isPending && <Spinner variant={"medium"} />}
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

export default withErrorBoundary(dontRenderUntilQueryParametersReady(ModuleCertificateVerification))
