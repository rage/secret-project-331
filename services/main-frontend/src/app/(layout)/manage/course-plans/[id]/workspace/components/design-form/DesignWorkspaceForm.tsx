"use client"

import { useTranslation } from "react-i18next"

import type { AnalysisWorkspaceV1 } from "@/generated/api/types.generated"
import { Checkbox, Disclosure, TextArea } from "@/shared-module/components"

import useStageWorkspaceForm from "../../hooks/useStageWorkspaceForm"
import useWorkspaceSectionNav from "../../hooks/useWorkspaceSectionNav"
import {
  formRootStyles,
  ROWS_LONG,
  ROWS_STANDARD,
  sectionAccentByIndex,
  subsectionTitleStyles,
} from "../analysis-form/analysisFormDomain"
import GuidanceText from "../GuidanceText"
import WorkspaceFormSection from "../WorkspaceFormSection"
import WorkspaceFormToolbar from "../WorkspaceFormToolbar"
import CourseStructureEditor from "./CourseStructureEditor"
import CreateCourseFromPlan from "./CreateCourseFromPlan"
import {
  DESIGN_SECTIONS,
  PLANNED_CONTENT_FORMATS,
  STAGE_DESIGN,
  STYLE_GUIDE_ITEMS,
  toDesignFormValues,
  toDesignWorkspace,
} from "./designFormDomain"
import {
  checkboxGridStyles,
  designListStyles,
  fieldsetStyles,
  guidanceCardStyles,
  legendStyles,
  threeColGridStyles,
  tipStyles,
} from "./designFormStyles"
import TextListEditor from "./TextListEditor"
import WorkloadCalculator from "./WorkloadCalculator"

const DESIGN_SECTION_DOM_IDS = DESIGN_SECTIONS.map((section) => section.domId)

/** The Design stage form: goals, content, structure, formats, style guide, exercises and workload. */
export default function DesignWorkspaceForm(props: {
  planId: string
  planName: string | null | undefined
  createdCourseId: string | null | undefined
  workspaceData: unknown
  /** The saved Analysis form, for course title, language and credits. */
  analysis: AnalysisWorkspaceV1
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { planId, planName, createdCourseId, workspaceData, analysis, onDirtyChange } = props
  const { t } = useTranslation()
  const { form, saveStatus, saveNow } = useStageWorkspaceForm({
    planId,
    stage: STAGE_DESIGN,
    workspaceData,
    toFormValues: toDesignFormValues,
    toWorkspace: toDesignWorkspace,
    ...(onDirtyChange ? { onDirtyChange } : {}),
  })
  const { control, setValue } = form
  const sectionNav = useWorkspaceSectionNav(DESIGN_SECTION_DOM_IDS)

  const sectionProps = (index: number) => {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- index is within DESIGN_SECTIONS
    const section = DESIGN_SECTIONS[index]!
    return {
      domId: section.domId,
      stage: STAGE_DESIGN,
      sectionKey: section.sectionKey,
      icon: section.icon,
      title: t(section.titleKey),
      accentClassName: sectionAccentByIndex[index % sectionAccentByIndex.length] ?? "",
      expanded: sectionNav.isExpanded(section.domId),
      onToggle: () => sectionNav.toggleSection(section.domId),
    }
  }

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
        stage={STAGE_DESIGN}
        sections={DESIGN_SECTIONS.map((section) => ({
          domId: section.domId,
          sectionKey: section.sectionKey,
          title: t(section.titleKey),
        }))}
        activeSectionId={sectionNav.activeSectionId}
        scrollToSection={sectionNav.scrollToSection}
        saveStatus={saveStatus}
        onSaveNow={() => void saveNow()}
      />

      <WorkspaceFormSection {...sectionProps(0)}>
        <GuidanceText text={t("course-plans-design-learning-goals-guidance")} />
        <p className={tipStyles}>{t("course-plans-design-learning-goals-tip")}</p>
        <TextListEditor
          control={control}
          name="learning_goals"
          itemLabel={(position) => t("course-plans-design-goal-label", { number: position })}
          removeLabel={(position) => t("course-plans-design-goal-remove", { number: position })}
          addLabel={t("course-plans-design-goal-add")}
        />
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(1)}>
        <GuidanceText text={t("course-plans-design-core-content-guidance")} />
        <div className={threeColGridStyles}>
          <TextArea
            name="core_content_must_know"
            control={control}
            label={t("course-plans-design-core-content-must")}
            description={t("course-plans-design-core-content-must-description")}
            rows={ROWS_LONG}
          />
          <TextArea
            name="core_content_should_know"
            control={control}
            label={t("course-plans-design-core-content-should")}
            description={t("course-plans-design-core-content-should-description")}
            rows={ROWS_LONG}
          />
          <TextArea
            name="core_content_nice_to_know"
            control={control}
            label={t("course-plans-design-core-content-nice")}
            description={t("course-plans-design-core-content-nice-description")}
            rows={ROWS_LONG}
          />
        </div>
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(2)}>
        <GuidanceText text={t("course-plans-design-course-structure-guidance")} />
        <CourseStructureEditor control={control} />
        <CreateCourseFromPlan
          planId={planId}
          planName={planName}
          createdCourseId={createdCourseId}
          analysis={analysis}
          savePendingChanges={saveNow}
        />
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(3)}>
        <GuidanceText text={t("course-plans-design-multimodality-guidance")} />
        <p className={tipStyles}>{t("course-plans-design-multimodality-tip")}</p>
        <h3 className={subsectionTitleStyles}>{t("course-plans-design-formats-heading")}</h3>
        <div className={designListStyles}>
          {PLANNED_CONTENT_FORMATS.map((entry) => (
            <Disclosure key={entry.format} title={t(entry.labelKey)}>
              <GuidanceText text={t(entry.guidanceKey)} />
            </Disclosure>
          ))}
        </div>
        <fieldset className={fieldsetStyles}>
          <legend className={legendStyles}>{t("course-plans-design-formats-planned")}</legend>
          <div className={checkboxGridStyles}>
            {PLANNED_CONTENT_FORMATS.map((entry) => (
              <Checkbox
                key={entry.format}
                name={`planned_content_formats.${entry.format}`}
                control={control}
                label={t(entry.labelKey)}
              />
            ))}
          </div>
        </fieldset>
        <TextArea
          name="content_format_notes"
          control={control}
          label={t("course-plans-design-formats-notes")}
          description={t("course-plans-design-formats-notes-description")}
          rows={ROWS_STANDARD}
        />
        <h3 className={subsectionTitleStyles}>{t("course-plans-design-accessibility-heading")}</h3>
        <GuidanceText text={t("course-plans-design-accessibility-guidance")} />
        <TextArea
          name="accessibility_notes"
          control={control}
          label={t("course-plans-design-accessibility-notes")}
          rows={ROWS_STANDARD}
        />
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(4)}>
        <GuidanceText text={t("course-plans-design-style-guide-guidance")} />
        {STYLE_GUIDE_ITEMS.map((entry) => (
          <TextArea
            key={entry.item}
            name={`style_guide.${entry.item}`}
            control={control}
            label={t(entry.labelKey)}
            description={t(entry.exampleKey)}
            rows={ROWS_STANDARD}
            autoResize
          />
        ))}
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(5)}>
        <GuidanceText text={t("course-plans-design-exercises-guidance")} />
        <p className={tipStyles}>{t("course-plans-design-exercises-tip")}</p>
        <div className={guidanceCardStyles}>
          <h4 className={legendStyles}>{t("course-plans-design-exercise-essay")}</h4>
          <GuidanceText text={t("course-plans-design-exercise-essay-guidance")} />
        </div>
        <div className={guidanceCardStyles}>
          <h4 className={legendStyles}>{t("course-plans-design-exercise-multiple-choice")}</h4>
          <GuidanceText text={t("course-plans-design-exercise-multiple-choice-guidance")} />
        </div>
        <GuidanceText text={t("course-plans-design-exercise-creating-guidance")} />
        <TextArea
          name="exercise_notes"
          control={control}
          label={t("course-plans-design-exercise-notes")}
          description={t("course-plans-design-exercise-notes-description")}
          rows={ROWS_STANDARD}
        />
        <h3 className={subsectionTitleStyles}>{t("course-plans-design-workload-heading")}</h3>
        <GuidanceText text={t("course-plans-design-workload-guidance")} />
        <WorkloadCalculator control={control} setValue={setValue} credits={analysis.credits} />
      </WorkspaceFormSection>

      <WorkspaceFormSection {...sectionProps(6)}>
        <GuidanceText text={t("course-plans-design-learning-types-intro")} />
      </WorkspaceFormSection>
    </form>
  )
}
