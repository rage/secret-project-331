"use client"

import { useQuery, UseQueryResult } from "@tanstack/react-query"
import { TFunction } from "i18next"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { generateCertificateMutation as generateCertificateMutationOptions } from "@/generated/api/@tanstack/react-query.generated"
import {
  getCertificateByConfigurationId,
  getCourse as getCourseFromApi,
  getCourseModule,
  getCourseModuleCompletion,
} from "@/generated/api/sdk.generated"
import type {
  Course,
  GeneratedCertificate,
  CourseModule as GeneratedCourseModule,
} from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import useUserInfo from "@/shared-module/common/hooks/useUserInfo"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { certificateValidateRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ModuleCertificate: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { confirm } = useDialog()
  const certificateConfigurationId = useQueryParameter("ccid")
  // Used to generate the right title
  const moduleId = useQueryParameter("module")
  const userInfo = useUserInfo()
  const [nameOnCertificate, setNameOnCertificate] = useState("")
  const existingCertificateQuery = useQuery({
    queryKey: ["getCertificateByConfigurationId", certificateConfigurationId],
    queryFn: (): Promise<GeneratedCertificate | null> =>
      getCertificateByConfigurationId({
        path: {
          certificate_configuration_id: assertNotNullOrUndefined(certificateConfigurationId),
        },
      }),
    enabled: certificateConfigurationId !== null,
  })

  useEffect(() => {
    if (!existingCertificateQuery.data) {
      return
    }
    router.replace(certificateValidateRoute(existingCertificateQuery.data.verification_id))
  }, [existingCertificateQuery.data, router])
  const courseAndModule = useQuery({
    queryKey: ["course-module", moduleId],
    queryFn: async () => {
      const courseModule = await getCourseModule({
        path: {
          course_module_id: assertNotNullOrUndefined(moduleId),
        },
      })
      const course = await getCourseFromApi({
        path: {
          course_id: courseModule.course_id,
        },
      })
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

  const userGrade = useQuery({
    queryKey: [`${moduleId}-course-module-completion`, moduleId],
    queryFn: async () => {
      const courseModule = await getCourseModuleCompletion({
        path: {
          course_module_id: assertNotNullOrUndefined(moduleId),
        },
      })
      if (!courseModule) {
        throw new Error("Course module completion not found")
      }
      const course = await getCourseFromApi({
        path: {
          course_id: courseModule.course_id,
        },
      })
      return { module: courseModule, course }
    },
    enabled: !!moduleId,
  })

  const grade = useMemo(() => {
    if (!userGrade.data?.module) {
      return ""
    }
    const moduleData = userGrade.data?.module
    if (moduleData.grade !== null) {
      return String(moduleData.grade)
    } else {
      return String(moduleData.passed)
    }
  }, [userGrade.data?.module])

  const generateCertificateMutation = useToastMutationOptions(
    generateCertificateMutationOptions(),
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
      {userGrade.isError && <ErrorBanner error={userGrade.error} variant={"readOnly"} />}
      {(userInfo.isLoading || courseAndModule.isLoading || userGrade.isLoading) && (
        <Spinner variant={"medium"} />
      )}
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
            disabled={!nameOnCertificate || userGrade.isLoading}
            onClick={async () => {
              if (
                await confirm(t("certificate-generation-confirmation", { name: nameOnCertificate }))
              ) {
                generateCertificateMutation.mutate({
                  body: {
                    certificate_configuration_id: assertNotNullOrUndefined(
                      certificateConfigurationId,
                    ),
                    name_on_certificate: nameOnCertificate,
                    grade,
                  },
                })
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
    module: GeneratedCourseModule
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

export default withErrorBoundary(withSignedIn(ModuleCertificate))
