import { useQuery, UseQueryResult } from "@tanstack/react-query"
import { TFunction } from "i18next"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { fetchCertificate, generateCertificate } from "../../services/backend/certificates"
import { fetchCourseModule } from "../../services/backend/course-modules"
import { getCourse } from "../../services/backend/courses"
import { Course, CourseModule } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import TextField from "../../shared-module/components/InputFields/TextField"
import Spinner from "../../shared-module/components/Spinner"
import { withSignedIn } from "../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../shared-module/hooks/useQueryParameter"
import useToastMutation from "../../shared-module/hooks/useToastMutation"
import useUserInfo from "../../shared-module/hooks/useUserInfo"
import dontRenderUntilQueryParametersReady from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { assertNotNullOrUndefined } from "../../shared-module/utils/nullability"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const ModuleCertificate: React.FC<React.PropsWithChildren<void>> = () => {
  const { t } = useTranslation()
  const router = useRouter()

  const certificateConfigurationId = useQueryParameter("ccid")
  // Used to generate the right title
  const moduleId = useQueryParameter("module")
  const userInfo = useUserInfo()
  const [nameOnCertificate, setNameOnCertificate] = useState("")
  useEffect(() => {
    if (!router || !router.isReady) {
      return
    }
    fetchCertificate(certificateConfigurationId).then((certificate) => {
      if (certificate !== null) {
        // found existing certificate, redirect
        // eslint-disable-next-line i18next/no-literal-string
        router.replace(`/certificates/validate/${certificate.verification_id}`)
      }
    })
  }, [certificateConfigurationId, router])
  const courseAndModule = useQuery({
    queryKey: ["course-module", moduleId],
    queryFn: async () => {
      const courseModule = await fetchCourseModule(assertNotNullOrUndefined(moduleId))
      const course = await getCourse(courseModule.course_id)
      return { module: courseModule, course }
    },
    enabled: !!moduleId,
  })

  useEffect(() => {
    if (userInfo.isSuccess && userInfo.data && nameOnCertificate === "") {
      setNameOnCertificate(
        `${userInfo.data.first_name ?? ""} ${userInfo.data.last_name ?? ""}`.trim(),
      )
    }
  }, [userInfo.isSuccess, userInfo.data, nameOnCertificate])
  const generateCertificateMutation = useToastMutation(
    () => {
      return generateCertificate(certificateConfigurationId, nameOnCertificate)
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        location.reload()
      },
    },
  )
  return (
    <>
      {courseAndModule.isError && (
        <ErrorBanner error={courseAndModule.error} variant={"readOnly"} />
      )}
      {userInfo.isPending || (courseAndModule.isPending && <Spinner variant={"medium"} />)}
      {courseAndModule.isSuccess && (
        <>
          <h2>{getHeaderContent(t, courseAndModule, moduleId)}</h2>
          <div>{t("certificate-generation-instructions")}</div>
          <hr />
          <TextField
            required
            label={t("your-name")}
            value={nameOnCertificate}
            onChange={(event) => setNameOnCertificate(event.target.value)}
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
    </>
  )
}

function getHeaderContent(
  t: TFunction,
  courseAndModule: UseQueryResult<{
    module: CourseModule
    course: Course
  }>,
  moduleId: string | null | undefined,
): string {
  if (moduleId === null || moduleId === undefined || !courseAndModule.data) {
    return t("generate-a-certificate")
  }
  if (courseAndModule.data.module.name) {
    return t("generate-a-certificate-for-completing-the-module-of-the-course", {
      module: courseAndModule.data.module.name,
      course: courseAndModule.data.course.name,
    })
  }
  return t("generate-a-certificate-for-completing-course", {
    course: courseAndModule.data.course.name,
  })
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ModuleCertificate)),
)
