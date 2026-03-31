"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { Checkbox, Radio, RadioGroup, TextArea, TextField } from "components"
import type { ReactNode } from "react"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { coursePlanQueryKeys } from "../../../coursePlanQueryKeys"

import {
  type AnalysisCourseType,
  type AnalysisWorkspaceV1,
  defaultAnalysisWorkspaceV1,
  parseAnalysisWorkspaceFromApi,
  patchCourseDesignerStageWorkspace,
} from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"

const formRootStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`

const sectionStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const sectionTitleStyles = css`
  font-size: 1rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
`

const staticTextStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.55;
  margin: 0;
  white-space: pre-line;
`

const checkboxGroupStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
`

const checkboxRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4, 1rem);
`

const roleTitleStyles = css`
  font-size: 0.95rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[800]};
  margin: 0.75rem 0 0.25rem 0;
`

const dutiesTextStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0 0 0.5rem 0;
`

const roleBlockStyles = css`
  margin: 0;
  padding: 0;
  border: 0;
`

const saveRowStyles = css`
  display: flex;
  justify-content: flex-start;
  margin-top: 0.5rem;
`

const uhBlockStyles = css`
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: ${baseTheme.colors.gray[50]};
  border: 1px solid ${baseTheme.colors.gray[200]};
`

const uhLineStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[700]};
  margin: 0.35rem 0;
  line-height: 1.5;
`

const uhLinkStyles = css`
  color: ${baseTheme.colors.green[700]};
  text-decoration: underline;
  word-break: break-all;
`

/**
 * Renders a line of localized resource text with mailto and https links activated.
 */
function linkifyResourceLine(line: string): ReactNode {
  const re = /(https?:\/\/[^\s]+)|([\w.+-]+@[\w.-]+\.[a-z]{2,})/gi
  const parts: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      parts.push(line.slice(last, match.index))
    }
    const url = match[1]
    const email = match[2]
    const href = url ?? `mailto:${email}`
    const label = match[0]
    parts.push(
      <a
        key={`${match.index}-${label}`}
        href={href}
        className={uhLinkStyles}
        {...(url ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {label}
      </a>,
    )
    last = match.index + match[0].length
  }
  if (last < line.length) {
    parts.push(line.slice(last))
  }
  return parts.length > 0 ? parts : line
}

/**
 * Loads and persists the Analysis stage workspace (v1) using react-hook-form.
 */
export default function AnalysisWorkspaceForm(props: {
  planId: string
  workspaceData: unknown | null
}) {
  const { planId, workspaceData } = props
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const form = useForm<AnalysisWorkspaceV1>({
    defaultValues: defaultAnalysisWorkspaceV1(),
  })

  const { control, handleSubmit, register, reset, setValue, getValues, watch } = form

  useEffect(() => {
    reset(parseAnalysisWorkspaceFromApi(workspaceData))
  }, [workspaceData, reset])

  const saveMutation = useToastMutation(
    (payload: AnalysisWorkspaceV1) =>
      patchCourseDesignerStageWorkspace(planId, "Analysis", {
        schema: "analysis_v1",
        payload,
      }),
    {
      notify: true,
      method: "PATCH",
      loadingText: t("course-plans-analysis-saving"),
    },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: coursePlanQueryKeys.detail(planId) })
      },
    },
  )

  const courseType = watch("course_type")

  const handleOpenPeriodChange = (
    key: "open_period_i" | "open_period_ii" | "open_period_iii" | "open_period_iv",
    checked: boolean,
  ) => {
    const current = getValues()
    const next = {
      ...current,
      [key]: checked,
    }
    setValue(key, checked)
    const allSelected =
      (key === "open_period_i" ? checked : next.open_period_i) &&
      (key === "open_period_ii" ? checked : next.open_period_ii) &&
      (key === "open_period_iii" ? checked : next.open_period_iii) &&
      (key === "open_period_iv" ? checked : next.open_period_iv)
    setValue("open_period_all", Boolean(allSelected))
  }

  const onSubmit = (data: AnalysisWorkspaceV1) => {
    saveMutation.mutate(data)
  }

  const uhBody = t("course-plans-analysis-resources-uh-body")
  const uhLines = uhBody.split("\n").filter((line) => line.trim() !== "")

  return (
    <form className={formRootStyles} onSubmit={handleSubmit(onSubmit)} noValidate>
      <section className={sectionStyles} aria-labelledby="analysis-section-1-heading">
        <h4 id="analysis-section-1-heading" className={sectionTitleStyles}>
          {t("course-plans-analysis-section-1")}
        </h4>
        <TextField
          label={t("course-plans-analysis-field-course-title")}
          {...register("course_title", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
        <Controller
          name="credits"
          control={control}
          rules={{
            validate: (v) =>
              v == null ||
              (typeof v === "number" && Number.isFinite(v)) ||
              t("course-plans-analysis-error-credits-invalid"),
          }}
          render={({ field, fieldState }) => (
            <TextField
              label={t("course-plans-analysis-field-credits")}
              inputMode="decimal"
              autoComplete="off"
              errorMessage={fieldState.error?.message}
              value={field.value == null ? "" : String(field.value)}
              onChange={(e) => {
                const raw = e.target.value.trim()
                if (raw === "") {
                  field.onChange(null)
                  return
                }
                const n = Number(raw.replace(",", "."))
                field.onChange(Number.isFinite(n) ? n : null)
              }}
              onBlur={field.onBlur}
            />
          )}
        />
        <TextField
          label={t("course-plans-analysis-field-language")}
          {...register("language", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
        <TextField
          label={t("course-plans-analysis-field-target-group")}
          {...register("target_group", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
        <fieldset className={roleBlockStyles}>
          <legend className={sectionTitleStyles}>{t("course-plans-analysis-field-mode")}</legend>
          <div className={checkboxRowStyles}>
            <Checkbox
              label={t("course-plans-analysis-mode-synchronous")}
              checked={watch("mode_synchronous")}
              onChange={(e) => setValue("mode_synchronous", e.target.checked)}
            />
            <Checkbox
              label={t("course-plans-analysis-mode-asynchronous")}
              checked={watch("mode_asynchronous")}
              onChange={(e) => setValue("mode_asynchronous", e.target.checked)}
            />
          </div>
        </fieldset>
        <fieldset className={roleBlockStyles}>
          <legend className={sectionTitleStyles}>
            {t("course-plans-analysis-field-open-periods")}
          </legend>
          <div className={checkboxGroupStyles}>
            <div className={checkboxRowStyles}>
              <Checkbox
                label={t("course-plans-analysis-period-i")}
                checked={watch("open_period_i")}
                onChange={(e) => handleOpenPeriodChange("open_period_i", e.target.checked)}
              />
              <Checkbox
                label={t("course-plans-analysis-period-ii")}
                checked={watch("open_period_ii")}
                onChange={(e) => handleOpenPeriodChange("open_period_ii", e.target.checked)}
              />
              <Checkbox
                label={t("course-plans-analysis-period-iii")}
                checked={watch("open_period_iii")}
                onChange={(e) => handleOpenPeriodChange("open_period_iii", e.target.checked)}
              />
              <Checkbox
                label={t("course-plans-analysis-period-iv")}
                checked={watch("open_period_iv")}
                onChange={(e) => handleOpenPeriodChange("open_period_iv", e.target.checked)}
              />
            </div>
            <Checkbox
              label={t("course-plans-analysis-period-all")}
              checked={watch("open_period_all")}
              onChange={(e) => {
                const c = e.target.checked
                setValue("open_period_all", c)
                if (c) {
                  setValue("open_period_i", true)
                  setValue("open_period_ii", true)
                  setValue("open_period_iii", true)
                  setValue("open_period_iv", true)
                } else {
                  setValue("open_period_i", false)
                  setValue("open_period_ii", false)
                  setValue("open_period_iii", false)
                  setValue("open_period_iv", false)
                }
              }}
            />
          </div>
        </fieldset>
        <TextField
          label={t("course-plans-analysis-field-responsible-teachers")}
          {...register("responsible_teachers", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
        <TextField
          label={t("course-plans-analysis-field-degree-programme")}
          {...register("degree_programme", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
        <RadioGroup
          label={t("course-plans-analysis-field-course-type")}
          name="course_type"
          value={courseType ?? ""}
          onChange={(v) =>
            setValue("course_type", v === "" ? null : (v as AnalysisCourseType), {
              shouldDirty: true,
            })
          }
        >
          <Radio value="" label={t("course-plans-analysis-course-type-none")} />
          <Radio value="Compulsory" label={t("course-plans-analysis-course-type-compulsory")} />
          <Radio value="Elective" label={t("course-plans-analysis-course-type-elective")} />
        </RadioGroup>
      </section>

      <section className={sectionStyles} aria-labelledby="analysis-section-2-heading">
        <h4 id="analysis-section-2-heading" className={sectionTitleStyles}>
          {t("course-plans-analysis-section-2")}
        </h4>
        <p className={staticTextStyles}>{t("course-plans-analysis-students-needs-intro")}</p>
        <TextArea
          label={t("course-plans-analysis-field-students-demographic")}
          rows={4}
          {...register("students_demographic_data", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
      </section>

      <section className={sectionStyles} aria-labelledby="analysis-section-3-heading">
        <h4 id="analysis-section-3-heading" className={sectionTitleStyles}>
          {t("course-plans-analysis-section-3")}
        </h4>
        <TextArea
          label={t("course-plans-analysis-field-wishes-topics")}
          rows={3}
          {...register("wishes_topics", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
        <fieldset className={roleBlockStyles}>
          <legend className={sectionTitleStyles}>
            {t("course-plans-analysis-field-content-format")}
          </legend>
          <div className={checkboxRowStyles}>
            <Checkbox
              label={t("course-plans-analysis-format-text")}
              checked={watch("wishes_content_format_text")}
              onChange={(e) => setValue("wishes_content_format_text", e.target.checked)}
            />
            <Checkbox
              label={t("course-plans-analysis-format-video")}
              checked={watch("wishes_content_format_video")}
              onChange={(e) => setValue("wishes_content_format_video", e.target.checked)}
            />
            <Checkbox
              label={t("course-plans-analysis-format-podcast")}
              checked={watch("wishes_content_format_podcast")}
              onChange={(e) => setValue("wishes_content_format_podcast", e.target.checked)}
            />
            <Checkbox
              label={t("course-plans-analysis-format-xr")}
              checked={watch("wishes_content_format_xr")}
              onChange={(e) => setValue("wishes_content_format_xr", e.target.checked)}
            />
          </div>
        </fieldset>
        <TextArea
          label={t("course-plans-analysis-field-content-format-notes")}
          rows={2}
          {...register("wishes_content_format_notes", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
        <TextArea
          label={t("course-plans-analysis-field-assessment")}
          rows={3}
          {...register("wishes_assessment_text", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
        <TextArea
          label={t("course-plans-analysis-field-wishes-other")}
          rows={3}
          {...register("wishes_other_suggestions", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
      </section>

      <section className={sectionStyles} aria-labelledby="analysis-section-4-heading">
        <h4 id="analysis-section-4-heading" className={sectionTitleStyles}>
          {t("course-plans-analysis-section-4")}
        </h4>
        <TextArea
          label={t("course-plans-analysis-field-market-results")}
          rows={4}
          {...register("market_results", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
      </section>

      <section className={sectionStyles} aria-labelledby="analysis-section-5-heading">
        <h4 id="analysis-section-5-heading" className={sectionTitleStyles}>
          {t("course-plans-analysis-section-5")}
        </h4>
        <TextArea
          label={t("course-plans-analysis-field-resources-university")}
          rows={3}
          {...register("resources_university", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
        <TextArea
          label={t("course-plans-analysis-field-resources-purchase")}
          rows={3}
          {...register("resources_purchase_budget", {
            setValueAs: (v: string) => (v === "" ? null : v),
          })}
        />
        <div className={uhBlockStyles}>
          <p className={staticTextStyles}>{t("course-plans-analysis-resources-uh-heading")}</p>
          {uhLines.map((line, index) => (
            <p key={`uh-line-${index}`} className={uhLineStyles}>
              {linkifyResourceLine(line)}
            </p>
          ))}
        </div>
      </section>

      <section className={sectionStyles} aria-labelledby="analysis-section-6-heading">
        <h4 id="analysis-section-6-heading" className={sectionTitleStyles}>
          {t("course-plans-analysis-section-6")}
        </h4>
        <p className={staticTextStyles}>{t("course-plans-analysis-contributors-intro")}</p>

        <div>
          <p className={roleTitleStyles}>
            {t("course-plans-analysis-role-instructional-designer")}
          </p>
          <p className={dutiesTextStyles}>
            {t("course-plans-analysis-role-responsibilities-label")}:{" "}
            {t("course-plans-analysis-role-instructional-designer-duties")}
          </p>
          <TextArea
            label={t("course-plans-analysis-assigned-persons")}
            rows={2}
            {...register("contributors_instructional_designer", {
              setValueAs: (v: string) => (v === "" ? null : v),
            })}
          />
        </div>

        <div>
          <p className={roleTitleStyles}>{t("course-plans-analysis-role-sme")}</p>
          <p className={dutiesTextStyles}>
            {t("course-plans-analysis-role-responsibilities-label")}:{" "}
            {t("course-plans-analysis-role-sme-duties")}
          </p>
          <TextArea
            label={t("course-plans-analysis-assigned-persons")}
            rows={2}
            {...register("contributors_subject_matter_experts", {
              setValueAs: (v: string) => (v === "" ? null : v),
            })}
          />
        </div>

        <div>
          <p className={roleTitleStyles}>{t("course-plans-analysis-role-editors")}</p>
          <p className={dutiesTextStyles}>
            {t("course-plans-analysis-role-responsibilities-label")}:{" "}
            {t("course-plans-analysis-role-editors-duties")}
          </p>
          <TextArea
            label={t("course-plans-analysis-assigned-persons")}
            rows={2}
            {...register("contributors_editors", {
              setValueAs: (v: string) => (v === "" ? null : v),
            })}
          />
        </div>

        <div>
          <p className={roleTitleStyles}>{t("course-plans-analysis-role-support")}</p>
          <p className={dutiesTextStyles}>
            {t("course-plans-analysis-role-responsibilities-label")}:{" "}
            {t("course-plans-analysis-role-support-duties")}
          </p>
          <TextArea
            label={t("course-plans-analysis-assigned-persons")}
            rows={2}
            {...register("contributors_support_staff", {
              setValueAs: (v: string) => (v === "" ? null : v),
            })}
          />
        </div>
      </section>

      <div className={saveRowStyles}>
        <Button type="submit" variant="primary" size="medium" disabled={saveMutation.isPending}>
          {saveMutation.isPending
            ? t("course-plans-analysis-saving")
            : t("course-plans-analysis-save")}
        </Button>
      </div>
    </form>
  )
}
