"use client"

import { useTranslation } from "react-i18next"

import type { AnalysisCourseType } from "@/generated/api/types.generated"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import {
  ComboBox,
  nullIfEmpty,
  NumberField,
  Select,
  TextArea,
  TextField,
} from "@/shared-module/components"

import useAnalysisWorkspaceFormController from "../hooks/useAnalysisWorkspaceFormController"
import useWorkspaceFormSections from "../hooks/useWorkspaceFormSections"
import {
  ANALYSIS_SECTIONS,
  CONTRIBUTOR_ROLES,
  contributorsListStyles,
  FIELD_COURSE_TYPE,
  FIELD_CREDITS,
  FIELD_LANGUAGE,
  formRootStyles,
  LANGUAGE_OPTIONS,
  linkifyResourceLine,
  modeAndPeriodsRowStyles,
  ROWS_LONG,
  ROWS_SHORT,
  ROWS_STANDARD,
  STAGE_ANALYSIS,
  staticTextStyles,
  subsectionTitleStyles,
  twoColGridStyles,
  uhCalloutStyles,
  uhCalloutTitleStyles,
  uhLineStyles,
} from "./analysis-form/analysisFormDomain"
import ContentFormatCheckboxes from "./analysis-form/ContentFormatCheckboxes"
import ContributorRoleBlock from "./analysis-form/ContributorRoleBlock"
import ModeCheckboxRow from "./analysis-form/ModeCheckboxRow"
import OpenPeriodCheckboxes from "./analysis-form/OpenPeriodCheckboxes"
import WorkspaceFormSection from "./WorkspaceFormSection"
import WorkspaceFormToolbar from "./WorkspaceFormToolbar"

export default function AnalysisWorkspaceForm(props: {
  onDirtyChange?: (dirty: boolean) => void
  planId: string
  workspaceData: unknown
  workspaceRevision: number
  isReadOnly: boolean
}) {
  const { onDirtyChange, planId, workspaceData, workspaceRevision, isReadOnly } = props
  const { t } = useTranslation()
  const {
    control,
    setValue,
    saveStatus,
    saveNow,
    loadLatest,
    creditsFieldRules,
    uhLines,
    showUhResources,
  } = useAnalysisWorkspaceFormController({
    planId,
    workspaceData,
    workspaceRevision,
    isReadOnly,
    ...omitUndefined({ onDirtyChange }),
  })
  const { sectionNav, sectionLinks, sectionProps } = useWorkspaceFormSections(
    ANALYSIS_SECTIONS,
    STAGE_ANALYSIS,
    isReadOnly,
  )

  return (
    <form
      className={formRootStyles}
      onSubmit={(event) => {
        event.preventDefault()
        void saveNow()
      }}
      noValidate
    >
      <WorkspaceFormToolbar
        stage={STAGE_ANALYSIS}
        sections={sectionLinks}
        activeSectionId={sectionNav.activeSectionId}
        scrollToSection={sectionNav.scrollToSection}
        saveStatus={saveStatus}
        onSaveNow={() => void saveNow()}
        onLoadLatest={loadLatest}
        isReadOnly={isReadOnly}
      />

      <WorkspaceFormSection {...sectionProps(0)}>
        <h3 className={subsectionTitleStyles}>{t("course-plans-analysis-subgroup-basic")}</h3>
        <TextField
          name="course_title"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-course-title")}
          description={t("course-plans-analysis-description-course-title")}
        />
        <div className={twoColGridStyles}>
          <NumberField
            name={FIELD_CREDITS}
            control={control}
            rules={creditsFieldRules}
            label={t("course-plans-analysis-field-credits")}
            description={t("course-plans-analysis-description-credits")}
            minValue={0}
          />
          <ComboBox
            name={FIELD_LANGUAGE}
            control={control}
            getItemKey={(item) => item.value}
            getItemTextValue={(item) => t(`course-plans-analysis-lang-${item.key}`)}
            label={t("course-plans-analysis-field-language")}
            description={t("course-plans-analysis-description-language")}
            items={LANGUAGE_OPTIONS}
            isEditable={false}
            placeholder={t("course-plans-analysis-language-placeholder")}
          >
            {(item) => t(`course-plans-analysis-lang-${item.key}`)}
          </ComboBox>
        </div>
        <TextArea
          name="target_group"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-target-group")}
          description={t("course-plans-analysis-description-target-group")}
          rows={ROWS_SHORT}
        />
        <h3 className={subsectionTitleStyles}>{t("course-plans-analysis-subgroup-logistics")}</h3>
        <div className={modeAndPeriodsRowStyles}>
          <ModeCheckboxRow control={control} t={t} />
          <OpenPeriodCheckboxes control={control} setValue={setValue} t={t} />
        </div>
        <h3 className={subsectionTitleStyles}>
          {t("course-plans-analysis-subgroup-organizational")}
        </h3>
        <TextArea
          name="responsible_teachers"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-teachers-in-charge")}
          description={t("course-plans-analysis-description-teachers-in-charge")}
          rows={ROWS_SHORT}
        />
        <div className={twoColGridStyles}>
          <TextField
            name="degree_programme"
            control={control}
            rules={nullIfEmpty}
            label={t("course-plans-analysis-field-degree-programme")}
            description={t("course-plans-analysis-description-degree-programme")}
          />
          <Select
            name={FIELD_COURSE_TYPE}
            control={control}
            rules={{
              setValueAs: (v: unknown) =>
                v === "" || v === null || v === undefined ? null : (v as AnalysisCourseType),
            }}
            label={t("course-plans-analysis-field-course-type")}
            options={[
              {
                value: "",
                label: t("course-plans-analysis-course-type-none"),
              },
              {
                // oxlint-disable-next-line i18next/no-literal-string -- backend enum value
                value: "compulsory",
                label: t("course-plans-analysis-course-type-compulsory"),
              },
              {
                // oxlint-disable-next-line i18next/no-literal-string -- backend enum value
                value: "elective",
                label: t("course-plans-analysis-course-type-elective"),
              },
            ]}
          />
        </div>
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(1)}>
        <p className={staticTextStyles}>{t("course-plans-analysis-students-needs-intro")}</p>
        <TextArea
          name="students_demographic_data"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-students-demographic")}
          description={t("course-plans-analysis-description-students-demographic")}
          rows={ROWS_LONG}
        />
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(2)}>
        <TextArea
          name="wishes_topics"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-wishes-topics")}
          placeholder={t("course-plans-analysis-placeholder-wishes-topics")}
          rows={ROWS_STANDARD}
        />
        <ContentFormatCheckboxes control={control} t={t} />
        <TextArea
          name="wishes_content_format_notes"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-content-format-notes")}
          placeholder={t("course-plans-analysis-placeholder-content-format-notes")}
          rows={ROWS_STANDARD}
        />
        <TextArea
          name="wishes_assessment_text"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-assessment")}
          placeholder={t("course-plans-analysis-placeholder-assessment")}
          rows={ROWS_STANDARD}
        />
        <TextArea
          name="wishes_other_suggestions"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-wishes-other")}
          placeholder={t("course-plans-analysis-placeholder-wishes-other")}
          rows={ROWS_STANDARD}
        />
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(3)}>
        <TextArea
          name="market_results"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-market-results")}
          description={t("course-plans-analysis-description-market-results")}
          rows={ROWS_LONG}
        />
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(4)}>
        <TextArea
          name="resources_university"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-resources-university")}
          placeholder={t("course-plans-analysis-placeholder-resources-university")}
          rows={ROWS_STANDARD}
        />
        <TextArea
          name="resources_purchase_budget"
          control={control}
          rules={nullIfEmpty}
          label={t("course-plans-analysis-field-resources-purchase")}
          placeholder={t("course-plans-analysis-placeholder-resources-purchase")}
          rows={ROWS_STANDARD}
        />
        {showUhResources ? (
          <div className={uhCalloutStyles}>
            <p className={uhCalloutTitleStyles}>
              {t("course-plans-analysis-resources-uh-heading")}
            </p>
            {uhLines.map((line, index) => (
              <p key={`uh-line-${index}`} className={uhLineStyles}>
                {linkifyResourceLine(line)}
              </p>
            ))}
          </div>
        ) : null}
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(5)}>
        <p className={staticTextStyles}>{t("course-plans-analysis-contributors-intro")}</p>
        <div className={contributorsListStyles}>
          {CONTRIBUTOR_ROLES.map((role) => (
            <ContributorRoleBlock
              key={role.field}
              control={control}
              field={role.field}
              nameKey={role.nameKey}
              dutiesKey={role.dutiesKey}
              t={t}
            />
          ))}
        </div>
      </WorkspaceFormSection>
    </form>
  )
}
