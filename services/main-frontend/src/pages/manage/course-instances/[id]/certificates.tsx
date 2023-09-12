import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import CertificateForm, {
  CertificateFields,
} from "../../../../components/page-specific/manage/certificates/CertificateForm"
import CertificateView from "../../../../components/page-specific/manage/certificates/CertificateView"
import {
  deleteCertificateConfiguration,
  updateCertificateConfiguration,
} from "../../../../services/backend/certificates"
import {
  fetchCertificateConfigurations,
  fetchCourseInstance,
} from "../../../../services/backend/course-instances"
import { setCertificationGeneration } from "../../../../services/backend/course-modules"
import { fetchCourseStructure } from "../../../../services/backend/courses"
import { CourseModuleCertificateConfigurationUpdate } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import HideTextInSystemTests from "../../../../shared-module/components/system-tests/HideTextInSystemTests"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../../../shared-module/hooks/useToastMutation"
import { baseTheme } from "../../../../shared-module/styles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<"id">
}

interface UpdateMutationArgs {
  courseModuleId: string
  courseInstanceId: string
  fields: CertificateFields
}

const CertificationsPage: React.FC<Props> = ({ query }) => {
  const { t } = useTranslation()
  const courseInstanceId = query.id

  const [editingConfiguration, setEditingConfiguration] = useState<string | null>(null)
  const getCourseInstance = useQuery({
    queryKey: ["course-instance", courseInstanceId],
    queryFn: () => {
      return fetchCourseInstance(courseInstanceId)
    },
  })
  const courseId = getCourseInstance.data?.course_id
  const getCourse = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => {
      if (courseId) {
        return fetchCourseStructure(courseId)
      } else {
        throw new Error("Invalid state")
      }
    },
    enabled: !!courseId,
  })
  const getCertificateConfigurations = useQuery({
    queryKey: ["certificate-configurations-for-instance", courseInstanceId],
    queryFn: () => {
      return fetchCertificateConfigurations(courseInstanceId)
    },
  })
  const updateConfigurationMutation = useToastMutation(
    ({ courseModuleId, courseInstanceId, fields }: UpdateMutationArgs) => {
      const backgroundSvg = fields.backgroundSvg.item(0)
      const overlaySvg = fields.overlaySvg.item(0)
      const update: CourseModuleCertificateConfigurationUpdate = {
        course_module_id: courseModuleId,
        course_instance_id: courseInstanceId,
        certificate_owner_name_y_pos: fields.ownerNamePosY,
        certificate_owner_name_x_pos: fields.ownerNamePosX,
        certificate_owner_name_font_size: fields.ownerNameFontSize,
        certificate_owner_name_text_color: fields.ownerNameTextColor,
        certificate_owner_name_text_anchor: fields.ownerNameTextAnchor,
        certificate_validate_url_y_pos: fields.validateUrlPosY,
        certificate_validate_url_x_pos: fields.validateUrlPosX,
        certificate_validate_url_font_size: fields.validateUrlFontSize,
        certificate_validate_url_text_color: fields.validateUrlTextColor,
        certificate_validate_url_text_anchor: fields.validateUrlTextAnchor,
        certificate_date_y_pos: fields.datePosY,
        certificate_date_x_pos: fields.datePosX,
        certificate_date_font_size: fields.dateFontSize,
        certificate_date_text_color: fields.dateTextColor,
        certificate_date_text_anchor: fields.dateTextAnchor,
        certificate_locale: fields.locale,
        paper_size: fields.paperSize,
        background_svg_file_name: backgroundSvg?.name ?? null,
        overlay_svg_file_name: overlaySvg?.name ?? null,
        clear_overlay_svg_file: fields.clearCurrentOverlaySvg,
      }
      return updateCertificateConfiguration(update, backgroundSvg, overlaySvg)
    },
    { method: "POST", notify: true },
    {
      onSuccess: () => {
        setEditingConfiguration(null)
        getCertificateConfigurations.refetch()
      },
    },
  )
  const deleteConfigurationMutation = useToastMutation(
    ({ moduleId, configurationId }: { moduleId: string; configurationId: string }) => {
      return setCertificationGeneration(moduleId, false).then(() =>
        deleteCertificateConfiguration(configurationId),
      )
    },
    {
      method: "DELETE",
      notify: true,
    },
    {
      onSuccess: () => {
        setEditingConfiguration(null)
        getCertificateConfigurations.refetch()
        getCourse.refetch()
      },
    },
  )
  const toggleCertificateGenerationEnabledMutation = useToastMutation(
    ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) => {
      return setCertificationGeneration(moduleId, enabled)
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        getCourse.refetch()
      },
    },
  )

  return (
    <>
      <h1>
        {t("certificates")}: {courseInstanceId}
      </h1>
      {getCertificateConfigurations.isError && (
        <ErrorBanner variant={"readOnly"} error={getCertificateConfigurations.error} />
      )}
      {getCertificateConfigurations.isLoading && <Spinner variant="medium" />}
      {getCourse.isSuccess && getCertificateConfigurations.isSuccess && (
        <>
          <ul
            className={css`
              padding-left: 0;
            `}
          >
            {getCourse.data.modules
              .sort((l, r) => l.order_number - r.order_number)
              .map((m) => {
                return {
                  module: m,
                  configuration:
                    getCertificateConfigurations.data.find((c) => c.course_module_id === m.id) ||
                    null,
                }
              })
              .map(({ module, configuration }) => (
                <li
                  key={module.id}
                  className={css`
                    list-style-type: none;
                    margin: 2rem 0;
                    border: 1px solid ${baseTheme.colors.clear[500]};
                    padding: 1rem;
                  `}
                >
                  <h2>
                    {module.name ? `${t("module")}: ${module.name}` : t("default-module")}{" "}
                    <HideTextInSystemTests text={module.id} testPlaceholder="module-id" />
                  </h2>
                  {module.id === editingConfiguration && (
                    <CertificateForm
                      generatingCertificatesEnabled={module.certification_enabled}
                      configuration={configuration}
                      onClickSave={(fields) => {
                        updateConfigurationMutation.mutate({
                          courseModuleId: module.id,
                          courseInstanceId,
                          fields,
                        })
                      }}
                      onClickCancel={() => {
                        setEditingConfiguration(null)
                      }}
                    />
                  )}
                  {module.id !== editingConfiguration &&
                    (configuration ? (
                      <>
                        <div>
                          {module.certification_enabled
                            ? t("generating-new-certificates-enabled")
                            : t("generating-new-certificates-disabled")}
                        </div>
                        {module.certification_enabled ? (
                          <Button
                            variant="primary"
                            size="medium"
                            onClick={() => {
                              if (window.confirm(t("confirm-disable-generating-certificates"))) {
                                toggleCertificateGenerationEnabledMutation.mutate({
                                  moduleId: module.id,
                                  enabled: false,
                                })
                              }
                            }}
                          >
                            {t("disable-generating-certificates")}
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="medium"
                            onClick={() => {
                              if (window.confirm(t("confirm-enable-generating-certificates"))) {
                                toggleCertificateGenerationEnabledMutation.mutate({
                                  moduleId: module.id,
                                  enabled: true,
                                })
                              }
                            }}
                          >
                            {t("enable-generating-certificates")}
                          </Button>
                        )}
                        <CertificateView
                          configuration={configuration}
                          onClickEdit={() => {
                            setEditingConfiguration(module.id)
                          }}
                          onClickDelete={() => {
                            if (window.confirm(t("confirm-certification-configuration-deletion"))) {
                              deleteConfigurationMutation.mutate({
                                moduleId: module.id,
                                configurationId: configuration.id,
                              })
                            }
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <div>{t("no-certificate-configured")}</div>
                        <Button
                          variant="primary"
                          size="medium"
                          onClick={() => setEditingConfiguration(module.id)}
                        >
                          {t("create-certificate-configuration")}
                        </Button>
                      </>
                    ))}
                </li>
              ))}
          </ul>
        </>
      )}
    </>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CertificationsPage)),
)
