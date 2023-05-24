import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import Layout from "../../components/Layout"
import { fetchCertificateImage } from "../../services/backend/certificates"
import Button from "../../shared-module/components/Button"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import { withSignedIn } from "../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<string>
}

const ModuleCertificateVerification: React.FC<React.PropsWithChildren<Props>> = ({ query }) => {
  const { t } = useTranslation()
  const certificateVerificationId = query.certificateVerificationId
  const debug = query.debug

  const certificate = useQuery(
    ["course-module-verification", certificateVerificationId, debug],
    async () => fetchCertificateImage(certificateVerificationId, debug === "true"),
  )
  return (
    <Layout>
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
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ModuleCertificateVerification)),
)
