"use client"

import { cx } from "@emotion/css"
import { useTranslation } from "react-i18next"

import useAnalysisWorkspaceFormController from "../hooks/useAnalysisWorkspaceFormController"

import ContentFormatCheckboxes from "./analysis-form/ContentFormatCheckboxes"
import ContributorRoleBlock from "./analysis-form/ContributorRoleBlock"
import ModeCheckboxRow from "./analysis-form/ModeCheckboxRow"
import OpenPeriodCheckboxes from "./analysis-form/OpenPeriodCheckboxes"
import SectionCollapsibleHeader from "./analysis-form/SectionCollapsibleHeader"
import {
  analysisSectionBodyId,
  analysisSectionHeadingId,
  CONTRIBUTOR_ROLES,
  contributorsListStyles,
  FIELD_COURSE_TYPE,
  FIELD_CREDITS,
  FIELD_LANGUAGE,
  formRootStyles,
  INPUT_MODE_DECIMAL,
  LANGUAGE_OPTIONS,
  linkifyResourceLine,
  modeAndPeriodsRowStyles,
  ROWS_LONG,
  ROWS_SHORT,
  ROWS_STANDARD,
  SECTION_DOM_PREFIX,
  sectionAccentByIndex,
  sectionBodyStyles,
  sectionCardStyles,
  sectionNavLinkActiveStyles,
  sectionNavLinkStyles,
  staticTextStyles,
  stickyNavStyles,
  stickyToolbarStyles,
  subsectionTitleStyles,
  toolbarRowStyles,
  twoColGridStyles,
  uhCalloutStyles,
  uhCalloutTitleStyles,
  uhLineStyles,
} from "./analysis-form/analysisFormDomain"

import type { AnalysisCourseType } from "@/generated/api/types.generated"
import {
  Button,
  ComboBox,
  nullIfEmpty,
  Select,
  TextArea,
  TextField,
} from "@/shared-module/components"

export default function AnalysisWorkspaceForm(props: {
  onDirtyChange?: (dirty: boolean) => void
  planId: string
  workspaceData: unknown | null
}) {
  const { onDirtyChange, planId, workspaceData } = props
  const { t } = useTranslation()
  const {
    form: { control, handleSubmit, setValue, onSubmit },
    expandedSections,
    activeSection,
    toggleSection,
    scrollToSection,
    saving,
    creditsFieldRules,
    uhLines,
    showUhResources,
    sectionNavKeys,
  } = useAnalysisWorkspaceFormController({
    planId,
    workspaceData,
    ...(onDirtyChange !== undefined ? { onDirtyChange } : {}),
  })

  return (
    <form className={formRootStyles} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={stickyToolbarStyles}>
        <div className={toolbarRowStyles}>
          <nav className={stickyNavStyles} aria-label={t("course-plans-analysis-nav-aria-label")}>
            {sectionNavKeys.map((key, index) => {
              const n = index + 1
              const sectionId = `${SECTION_DOM_PREFIX}${n}`
              return (
                <a
                  key={sectionId}
                  href={`#${sectionId}`}
                  className={cx(
                    sectionNavLinkStyles,
                    activeSection === n && sectionNavLinkActiveStyles,
                  )}
                  onClick={scrollToSection(sectionId)}
                >
                  {t(key)}
                </a>
              )
            })}
          </nav>
          <Button
            type="submit"
            variant="primary"
            size="medium"
            disabled={saving}
            aria-label={t("course-plans-analysis-sticky-save-aria")}
          >
            {saving ? t("course-plans-analysis-saving") : t("course-plans-analysis-save-now")}
          </Button>
        </div>
      </div>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[0])}
        id={`${SECTION_DOM_PREFIX}1`}
        aria-labelledby={analysisSectionHeadingId(1)}
      >
        <SectionCollapsibleHeader
          sectionNum={1}
          expanded={expandedSections[1] !== false}
          onToggle={() => toggleSection(1)}
          title={t("course-plans-analysis-section-1")}
        />
        {expandedSections[1] !== false ? (
          <div id={analysisSectionBodyId(1)} className={sectionBodyStyles}>
            <h3 className={subsectionTitleStyles}>{t("course-plans-analysis-subgroup-basic")}</h3>
            <TextField
              name="course_title"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-course-title")}
              description={t("course-plans-analysis-description-course-title")}
            />
            <div className={twoColGridStyles}>
              <TextField
                name={FIELD_CREDITS}
                control={control}
                rules={creditsFieldRules}
                label={t("course-plans-analysis-field-credits")}
                description={t("course-plans-analysis-description-credits")}
                inputMode={INPUT_MODE_DECIMAL}
                autoComplete="off"
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
            <h3 className={subsectionTitleStyles}>
              {t("course-plans-analysis-subgroup-logistics")}
            </h3>
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
          </div>
        ) : null}
      </section>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[1])}
        id={`${SECTION_DOM_PREFIX}2`}
        aria-labelledby={analysisSectionHeadingId(2)}
      >
        <SectionCollapsibleHeader
          sectionNum={2}
          expanded={expandedSections[2] !== false}
          onToggle={() => toggleSection(2)}
          title={t("course-plans-analysis-section-2")}
        />
        {expandedSections[2] !== false ? (
          <div id={analysisSectionBodyId(2)} className={sectionBodyStyles}>
            <p className={staticTextStyles}>{t("course-plans-analysis-students-needs-intro")}</p>
            <TextArea
              name="students_demographic_data"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-students-demographic")}
              description={t("course-plans-analysis-description-students-demographic")}
              rows={ROWS_LONG}
            />
          </div>
        ) : null}
      </section>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[2])}
        id={`${SECTION_DOM_PREFIX}3`}
        aria-labelledby={analysisSectionHeadingId(3)}
      >
        <SectionCollapsibleHeader
          sectionNum={3}
          expanded={expandedSections[3] !== false}
          onToggle={() => toggleSection(3)}
          title={t("course-plans-analysis-section-3")}
        />
        {expandedSections[3] !== false ? (
          <div id={analysisSectionBodyId(3)} className={sectionBodyStyles}>
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
          </div>
        ) : null}
      </section>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[3])}
        id={`${SECTION_DOM_PREFIX}4`}
        aria-labelledby={analysisSectionHeadingId(4)}
      >
        <SectionCollapsibleHeader
          sectionNum={4}
          expanded={expandedSections[4] !== false}
          onToggle={() => toggleSection(4)}
          title={t("course-plans-analysis-section-4")}
        />
        {expandedSections[4] !== false ? (
          <div id={analysisSectionBodyId(4)} className={sectionBodyStyles}>
            <TextArea
              name="market_results"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-market-results")}
              description={t("course-plans-analysis-description-market-results")}
              rows={ROWS_LONG}
            />
          </div>
        ) : null}
      </section>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[4])}
        id={`${SECTION_DOM_PREFIX}5`}
        aria-labelledby={analysisSectionHeadingId(5)}
      >
        <SectionCollapsibleHeader
          sectionNum={5}
          expanded={expandedSections[5] !== false}
          onToggle={() => toggleSection(5)}
          title={t("course-plans-analysis-section-5")}
        />
        {expandedSections[5] !== false ? (
          <div id={analysisSectionBodyId(5)} className={sectionBodyStyles}>
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
          </div>
        ) : null}
      </section>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[5])}
        id={`${SECTION_DOM_PREFIX}6`}
        aria-labelledby={analysisSectionHeadingId(6)}
      >
        <SectionCollapsibleHeader
          sectionNum={6}
          expanded={expandedSections[6] !== false}
          onToggle={() => toggleSection(6)}
          title={t("course-plans-analysis-section-6")}
        />
        {expandedSections[6] !== false ? (
          <div id={analysisSectionBodyId(6)} className={sectionBodyStyles}>
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
          </div>
        ) : null}
      </section>
    </form>
  )
}
