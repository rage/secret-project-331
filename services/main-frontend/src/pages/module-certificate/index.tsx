import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../components/Layout"
import { fetchCertificate, generateCertificate } from "../../services/backend/certificates"
import { fetchCourseModule } from "../../services/backend/course-modules"
import { getCourse } from "../../services/backend/courses"
import Button from "../../shared-module/components/Button"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import TextField from "../../shared-module/components/InputFields/TextField"
import Spinner from "../../shared-module/components/Spinner"
import { withSignedIn } from "../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../shared-module/hooks/useQueryParameter"
import useToastMutation from "../../shared-module/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const ModuleCertificate: React.FC<React.PropsWithChildren<void>> = () => {
  const { t } = useTranslation()

  const moduleId = useQueryParameter("module")
  const courseInstanceId = useQueryParameter("instance")
  const [nameOnCertificate, setNameOnCertificate] = useState("")
  useEffect(() => {
    fetchCertificate(moduleId, courseInstanceId).then((certificate) => {
      if (certificate !== null) {
        // found existing certificate, redirect
        window.location.replace(`/certificates/${certificate.verification_id}`)
      }
    })
  }, [moduleId, courseInstanceId])
  const courseAndModule = useQuery(["course-module", moduleId], async () => {
    const module = await fetchCourseModule(moduleId)
    const course = await getCourse(module.course_id)
    return { module, course }
  })
  const generateCertificateMutation = useToastMutation(
    () => {
      return generateCertificate(moduleId, courseInstanceId, nameOnCertificate)
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        location.reload()
      },
    },
  )
  return (
    <Layout>
      {courseAndModule.isError && (
        <ErrorBanner error={courseAndModule.error} variant={"readOnly"} />
      )}
      {courseAndModule.isLoading && <Spinner variant={"medium"} />}
      {courseAndModule.isSuccess && (
        <>
          <h2>
            {t("generate-a-certificate-for-completing-the-module-of-the-course", {
              module: courseAndModule.data.module.name ?? t("default"),
              course: courseAndModule.data.course.name,
            })}
          </h2>
          <div>{t("certificate-generation-instructions")}</div>
          <hr />
          <TextField
            required
            label={"Your name"}
            onChange={(val) => setNameOnCertificate(val)}
          ></TextField>
          <Button
            size="medium"
            variant="primary"
            disabled={!nameOnCertificate}
            onClick={() => {
              if (
                window.confirm(
                  t("certificate-generation-confirmation", { name: nameOnCertificate }),
                )
              ) {
                generateCertificateMutation.mutate()
              }
            }}
          >
            {t("generate")}
          </Button>
        </>
      )}
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ModuleCertificate)),
)
