"use client"

import { css } from "@emotion/css"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createCourseFromCourseDesignerPlanMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { AnalysisWorkspaceV1 } from "@/generated/api/types.generated"
import useAllOrganizationsQuery from "@/hooks/useAllOrganizationsQuery"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import { baseTheme } from "@/shared-module/common/styles"
import {
  Button,
  Dialog,
  Checkbox,
  ErrorNotice,
  Infobox,
  LoadingRegion,
  Select,
  Spinner,
  TextField,
  TONE,
} from "@/shared-module/components"

import { useInvalidatePlan } from "../../../hooks/useInvalidatePlan"
import { LANGUAGE_OPTIONS } from "./analysis-form/analysisFormDomain"
import GuidanceText from "./GuidanceText"

const createBlockStyles = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid ${baseTheme.colors.gray[200]};
`

const progressStyles = css`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[700]};
  line-height: 1.5;
  margin: 0;
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
  give_members_course_roles: boolean
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
  onClose: () => void
}) {
  const { planId, defaultName, defaultLanguageCode, onClose } = props
  const { t } = useTranslation()
  const invalidatePlan = useInvalidatePlan(planId)
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
    defaultValues: {
      organization_id: "",
      name: defaultName,
      language_code: defaultLanguageCode,
      give_members_course_roles: false,
    },
  })

  const mutation = useMutation({
    ...createCourseFromCourseDesignerPlanMutation(),
    onSuccess: async () => {
      await invalidatePlan()
      onClose()
    },
  })

  const onSubmit = (values: CreateCourseFormValues) => {
    mutation.mutate({
      path: { plan_id: planId },
      body: {
        organization_id: values.organization_id,
        name: values.name.trim() === "" ? null : values.name,
        language_code: values.language_code,
        give_members_course_roles: values.give_members_course_roles,
      },
    })
  }

  const isLoadingOrganizations = organizationsQuery.isLoading || permissionQuery.isLoading
  const isDrafting = mutation.isPending

  return (
    <Dialog
      open
      onClose={() => {
        if (!isDrafting) {
          onClose()
        }
      }}
      isDismissable={false}
      isKeyboardDismissDisabled={isDrafting}
      showCloseButton={!isDrafting}
      title={t("course-plans-create-course-dialog-title")}
      actions={[
        {
          label: t("course-plans-create-course-cancel"),
          variant: "secondary",
          disabled: isDrafting,
          onPress: onClose,
        },
        {
          label: mutation.isError
            ? t("course-plans-create-course-retry")
            : t("course-plans-create-course-confirm"),
          variant: "primary",
          isLoading: isDrafting,
          disabled: allowedOrganizations.length === 0,
          onPress: () => void handleSubmit(onSubmit)(),
        },
      ]}
    >
      <div className={dialogBodyStyles}>
        {isDrafting ? (
          <p className={progressStyles} role="status">
            <Spinner />
            <span>
              <strong>{t("course-plans-create-course-progress-title")}</strong>
              <br />
              {t("course-plans-create-course-progress-body")}
            </span>
          </p>
        ) : null}
        <Infobox tone={TONE.INFO}>{t("course-plans-create-course-ai-drafts")}</Infobox>
        <Infobox tone={TONE.WARNING}>{t("course-plans-create-course-one-way")}</Infobox>
        {isLoadingOrganizations ? (
          <LoadingRegion />
        ) : allowedOrganizations.length === 0 ? (
          <p className={hintStyles}>{t("course-plans-create-course-no-organizations")}</p>
        ) : (
          <Select
            name="organization_id"
            control={control}
            rules={{ required: t("course-plans-create-course-organization-required") }}
            label={t("course-plans-create-course-organization")}
            placeholder={t("course-plans-create-course-organization-placeholder")}
            isDisabled={isDrafting}
            options={allowedOrganizations.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
          />
        )}
        <TextField
          name="name"
          control={control}
          label={t("course-plans-create-course-name")}
          description={t("course-plans-create-course-name-description")}
          isDisabled={isDrafting}
        />
        <Select
          name="language_code"
          control={control}
          label={t("course-plans-create-course-language")}
          isDisabled={isDrafting}
          options={LANGUAGE_OPTIONS.map((option) => ({
            value: option.key,
            label: t(`course-plans-analysis-lang-${option.key}`),
          }))}
        />
        <Checkbox
          name="give_members_course_roles"
          control={control}
          label={t("course-plans-create-course-give-members-access")}
          description={t("course-plans-create-course-give-members-access-description")}
          isDisabled={isDrafting}
        />
        {mutation.isError ? <ErrorNotice error={mutation.error} /> : null}
      </div>
    </Dialog>
  )
}

/** The Development stage's offer to create the plan's course, which every later stage needs. */
export default function CreateCourseOffer(props: {
  planId: string
  planName: string | null | undefined
  analysis: AnalysisWorkspaceV1
  /** Creating is allowed only once the Design stage is done. */
  isDesignCompleted: boolean
  isReadOnly: boolean
}) {
  const { planId, planName, analysis, isDesignCompleted, isReadOnly } = props
  const { t } = useTranslation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <div className={createBlockStyles}>
      <GuidanceText text={t("course-plans-create-course-hint")} />
      {isReadOnly ? null : isDesignCompleted ? (
        <Button type="button" variant="primary" size="medium" onClick={() => setIsDialogOpen(true)}>
          {t("course-plans-create-course")}
        </Button>
      ) : (
        <p className={hintStyles}>{t("course-plans-create-course-design-not-done")}</p>
      )}
      {isDialogOpen ? (
        <CreateCourseDialog
          planId={planId}
          defaultName={analysis.course_title?.trim() || planName || ""}
          defaultLanguageCode={languageCodeFromAnalysis(analysis.language)}
          onClose={() => setIsDialogOpen(false)}
        />
      ) : null}
    </div>
  )
}
