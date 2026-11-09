"use client"

import { css } from "@emotion/css"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  createCourseFromCourseDesignerPlanMutation,
  getCourseDesignerPlanQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import type { AnalysisWorkspaceV1 } from "@/generated/api/types.generated"
import useAllOrganizationsQuery from "@/hooks/useAllOrganizationsQuery"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import { baseTheme } from "@/shared-module/common/styles"
import { manageCourseRoute } from "@/shared-module/common/utils/routes"
import {
  Button,
  Dialog,
  ErrorNotice,
  Infobox,
  Link,
  LoadingRegion,
  Select,
  TextField,
  TONE,
} from "@/shared-module/components"

import { LANGUAGE_OPTIONS } from "../analysis-form/analysisFormDomain"
import GuidanceText from "../GuidanceText"

const createBlockStyles = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid ${baseTheme.colors.gray[200]};
`

const hintStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.5;
  margin: 0;
`

const dialogBodyStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

interface CreateCourseFormValues {
  organization_id: string
  name: string
  language_code: string
}

function languageCodeFromAnalysis(language: string | null | undefined): string {
  const match = LANGUAGE_OPTIONS.find(
    (option) => option.value === language || option.key === language,
  )
  return match?.key ?? LANGUAGE_OPTIONS[0].key
}

function CreateCourseDialog(props: {
  planId: string
  defaultName: string
  defaultLanguageCode: string
  /** Saves pending Design form edits so the course is built from the latest structure. */
  savePendingChanges: () => Promise<boolean>
  onClose: () => void
}) {
  const { planId, defaultName, defaultLanguageCode, savePendingChanges, onClose } = props
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const organizationsQuery = useAllOrganizationsQuery()
  const organizations = organizationsQuery.data ?? []
  const permissionQuery = useAuthorizeMultiple(
    organizations.map((organization) => ({
      action: { type: "create_courses_or_exams" },
      resource: { type: "organization", id: organization.id },
    })),
  )
  const allowedOrganizations = organizations.filter(
    (_organization, index) => permissionQuery.data?.[index] === true,
  )

  const { control, handleSubmit } = useForm<CreateCourseFormValues>({
    defaultValues: { organization_id: "", name: defaultName, language_code: defaultLanguageCode },
  })

  const mutation = useMutation({
    ...createCourseFromCourseDesignerPlanMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }),
      })
      onClose()
    },
  })

  const [hasPendingSaveFailed, setHasPendingSaveFailed] = useState(false)

  const onSubmit = async (values: CreateCourseFormValues) => {
    const isSaved = await savePendingChanges()
    setHasPendingSaveFailed(!isSaved)
    if (!isSaved) {
      return
    }
    mutation.mutate({
      path: { plan_id: planId },
      body: {
        organization_id: values.organization_id,
        name: values.name.trim() === "" ? null : values.name,
        language_code: values.language_code,
      },
    })
  }

  const isLoadingOrganizations = organizationsQuery.isLoading || permissionQuery.isLoading

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("course-plans-design-create-course-dialog-title")}
      actions={[
        {
          label: t("course-plans-design-create-course-cancel"),
          variant: "secondary",
          onPress: onClose,
        },
        {
          label: t("course-plans-design-create-course-confirm"),
          variant: "primary",
          isLoading: mutation.isPending,
          disabled: allowedOrganizations.length === 0,
          onPress: () => void handleSubmit(onSubmit)(),
        },
      ]}
    >
      <div className={dialogBodyStyles}>
        <Infobox tone={TONE.WARNING}>{t("course-plans-design-create-course-one-way")}</Infobox>
        {isLoadingOrganizations ? (
          <LoadingRegion />
        ) : allowedOrganizations.length === 0 ? (
          <p className={hintStyles}>{t("course-plans-design-create-course-no-organizations")}</p>
        ) : (
          <Select
            name="organization_id"
            control={control}
            rules={{ required: t("course-plans-design-create-course-organization-required") }}
            label={t("course-plans-design-create-course-organization")}
            placeholder={t("course-plans-design-create-course-organization-placeholder")}
            options={allowedOrganizations.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
          />
        )}
        <TextField
          name="name"
          control={control}
          label={t("course-plans-design-create-course-name")}
          description={t("course-plans-design-create-course-name-description")}
        />
        <Select
          name="language_code"
          control={control}
          label={t("course-plans-design-create-course-language")}
          options={LANGUAGE_OPTIONS.map((option) => ({
            value: option.key,
            label: t(`course-plans-analysis-lang-${option.key}`),
          }))}
        />
        {hasPendingSaveFailed ? (
          <Infobox tone={TONE.DANGER} announce>
            {t("course-plans-design-create-course-save-failed")}
          </Infobox>
        ) : null}
        {mutation.isError ? <ErrorNotice error={mutation.error} /> : null}
      </div>
    </Dialog>
  )
}

/**
 * "Create course" for the planned course structure, or a link to the course once the plan has
 * created one. Creating is one-way: later structure edits do not reach the course.
 */
export default function CreateCourseFromPlan(props: {
  planId: string
  planName: string | null | undefined
  createdCourseId: string | null | undefined
  analysis: AnalysisWorkspaceV1
  savePendingChanges: () => Promise<boolean>
}) {
  const { planId, planName, createdCourseId, analysis, savePendingChanges } = props
  const { t } = useTranslation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  if (createdCourseId) {
    return (
      <div className={createBlockStyles}>
        <p className={hintStyles}>{t("course-plans-design-course-created")}</p>
        <Link
          href={manageCourseRoute(createdCourseId)}
          styledAsButton
          variant="primary"
          size="medium"
        >
          {t("course-plans-design-open-course")}
        </Link>
      </div>
    )
  }

  return (
    <div className={createBlockStyles}>
      <Button type="button" variant="primary" size="medium" onClick={() => setIsDialogOpen(true)}>
        {t("course-plans-design-create-course")}
      </Button>
      <GuidanceText text={t("course-plans-design-create-course-hint")} />
      {isDialogOpen ? (
        <CreateCourseDialog
          planId={planId}
          defaultName={analysis.course_title?.trim() || planName || ""}
          defaultLanguageCode={languageCodeFromAnalysis(analysis.language)}
          savePendingChanges={savePendingChanges}
          onClose={() => setIsDialogOpen(false)}
        />
      ) : null}
    </div>
  )
}
