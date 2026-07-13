"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { CertificateFields } from "./CertificateForm"
import CertificateForm from "./CertificateForm"
import CertificateView from "./CertificateView"
import { createCertificateConfigurationFormData } from "./certificateConfigurationFormData"

import {
  getCourseInstanceDefaultCertificateConfigurationsOptions,
  getCourseInstanceOptions,
  getCourseStructureOptions,
  setCourseModuleCertificateGenerationMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  deleteCertificateConfiguration,
  setCourseModuleCertificateGeneration,
  updateCertificateConfiguration,
} from "@/generated/api/sdk.generated"
import type { UpdateCertificateConfigurationData } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UpdateMutationArgs {
  courseModuleId: string
  courseInstanceId: string
  fields: CertificateFields
}

const CertificationsPage: React.FC = () => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const { id: courseInstanceId } = useParams<{ id: string }>()

  const [editingConfiguration, setEditingConfiguration] = useState<string | null>(null)
  const getCourseInstance = useQuery({
    ...getCourseInstanceOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
  })
  const courseId = getCourseInstance.data?.course_id
  const getCourse = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseStructureOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  )
  const defaultCertificateConfigurationsQuery = useQuery({
    ...getCourseInstanceDefaultCertificateConfigurationsOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
  })
  const updateConfigurationMutation = useToastMutation(
    ({ courseModuleId, courseInstanceId: instanceId, fields }: UpdateMutationArgs) => {
      const backgroundSvg = fields.backgroundSvg.item(0)
      const overlaySvg = fields.overlaySvg.item(0)
      const metadata: UpdateCertificateConfigurationData["body"]["metadata"] = {
        course_module_id: courseModuleId,
        course_instance_id: instanceId,
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
        render_certificate_grade: fields.renderGrade,
        certificate_grade_y_pos: fields.gradePosY,
        certificate_grade_x_pos: fields.gradePosX,
        certificate_grade_font_size: fields.gradeFontSize,
        certificate_grade_text_color: fields.gradeTextColor,
        certificate_grade_text_anchor: fields.gradeTextAnchor,
      }

      const files = [overlaySvg, backgroundSvg].filter((file): file is File => file !== null)

      return updateCertificateConfiguration({
        body: {
          metadata,
          file: files,
        },
        bodySerializer: () => createCertificateConfigurationFormData(metadata, files),
      })
    },
    { method: "POST", notify: true },
    {
      onSuccess: () => {
        setEditingConfiguration(null)
        defaultCertificateConfigurationsQuery.refetch()
      },
    },
  )
  const deleteConfigurationMutation = useToastMutation(
    ({ moduleId, configurationId }: { moduleId: string; configurationId: string }) => {
      return setCourseModuleCertificateGeneration({
        path: {
          course_module_id: moduleId,
          enabled: false,
        },
      }).then(() =>
        deleteCertificateConfiguration({
          path: {
            certificate_configuration_id: configurationId,
          },
        }),
      )
    },
    {
      method: "DELETE",
      notify: true,
    },
    {
      onSuccess: () => {
        setEditingConfiguration(null)
        defaultCertificateConfigurationsQuery.refetch()
        getCourse.refetch()
      },
    },
  )
  const toggleCertificateGenerationEnabledMutation = useToastMutationOptions(
    setCourseModuleCertificateGenerationMutation(),
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
      {defaultCertificateConfigurationsQuery.isError && (
        <ErrorBanner variant={"readOnly"} error={defaultCertificateConfigurationsQuery.error} />
      )}
      {defaultCertificateConfigurationsQuery.isLoading && <Spinner variant="medium" />}
      {getCourse.isSuccess && defaultCertificateConfigurationsQuery.isSuccess && (
        <ul
          className={css`
            padding-left: 0;
          `}
        >
          {getCourse.data.modules
            .toSorted((l, r) => l.order_number - r.order_number)
            .map((m) => {
              return {
                module: m,
                configuration:
                  defaultCertificateConfigurationsQuery.data.find(
                    (c) =>
                      c.requirements.course_module_ids.length === 1 &&
                      c.requirements.course_module_ids[0] === m.id,
                  ) || null,
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
                    configurationAndRequirements={configuration}
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
                          onClick={async () => {
                            if (await confirm(t("confirm-disable-generating-certificates"))) {
                              toggleCertificateGenerationEnabledMutation.mutate({
                                path: {
                                  course_module_id: module.id,
                                  enabled: false,
                                },
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
                          onClick={async () => {
                            if (await confirm(t("confirm-enable-generating-certificates"))) {
                              toggleCertificateGenerationEnabledMutation.mutate({
                                path: {
                                  course_module_id: module.id,
                                  enabled: true,
                                },
                              })
                            }
                          }}
                        >
                          {t("enable-generating-certificates")}
                        </Button>
                      )}
                      <CertificateView
                        configurationAndRequirements={configuration}
                        onClickEdit={() => {
                          setEditingConfiguration(module.id)
                        }}
                        onClickDelete={async () => {
                          if (await confirm(t("confirm-certification-configuration-deletion"))) {
                            deleteConfigurationMutation.mutate({
                              moduleId: module.id,
                              configurationId: configuration.certificate_configuration.id,
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
      )}
    </>
  )
}

export default withErrorBoundary(withSignedIn(CertificationsPage))
