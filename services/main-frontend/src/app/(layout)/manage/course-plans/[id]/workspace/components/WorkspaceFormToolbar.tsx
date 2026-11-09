"use client"

import { css, cx } from "@emotion/css"
import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"

import type { CourseDesignerStage } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

import type { WorkspaceSaveStatus } from "../hooks/useStageWorkspaceForm"
import {
  sectionNavLinkActiveStyles,
  sectionNavLinkStyles,
  stickyNavStyles,
  stickyToolbarStyles,
  toolbarRowStyles,
} from "./analysis-form/analysisFormDomain"
import { SectionStatusDot } from "./section-status/SectionStatusBadge"

const saveAreaStyles = css`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
`

const statusTextStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
  max-width: 28rem;
`

const statusErrorStyles = css`
  color: ${baseTheme.colors.red[700]};
`

export interface WorkspaceFormSectionLink {
  domId: string
  sectionKey: string
  title: string
}

/** Sticky bar of a stage form: section links with their marks, save status and Save now. */
export default function WorkspaceFormToolbar(props: {
  stage: CourseDesignerStage
  sections: readonly WorkspaceFormSectionLink[]
  activeSectionId: string | null
  scrollToSection: (domId: string) => (event: MouseEvent<HTMLAnchorElement>) => void
  saveStatus: WorkspaceSaveStatus
  onSaveNow: () => void
}) {
  const { stage, sections, activeSectionId, scrollToSection, saveStatus, onSaveNow } = props
  const { t } = useTranslation()

  let statusText: string | null = null
  switch (saveStatus.state) {
    case "saving":
      statusText = t("course-plans-save-status-saving")
      break
    case "saved":
      statusText = t("course-plans-save-status-saved")
      break
    case "unsaved":
      statusText = t("course-plans-save-status-unsaved")
      break
    case "error":
      statusText = t("course-plans-save-status-error", { message: saveStatus.errorMessage ?? "" })
      break
    case "idle":
      statusText = t("course-plans-save-status-autosave")
      break
  }
  const isError = saveStatus.state === "error"

  return (
    <div className={stickyToolbarStyles}>
      <div className={toolbarRowStyles}>
        <nav className={stickyNavStyles} aria-label={t("course-plans-analysis-nav-aria-label")}>
          {sections.map((section) => (
            <a
              key={section.domId}
              href={`#${section.domId}`}
              className={cx(
                sectionNavLinkStyles,
                activeSectionId === section.domId && sectionNavLinkActiveStyles,
              )}
              onClick={scrollToSection(section.domId)}
            >
              {section.title}
              <SectionStatusDot stage={stage} sectionKey={section.sectionKey} />
            </a>
          ))}
        </nav>
        <div className={saveAreaStyles}>
          <p className={cx(statusTextStyles, isError && statusErrorStyles)} role="status">
            {statusText}
            {saveStatus.hasSkippedInvalidFields && saveStatus.state !== "saving"
              ? ` ${t("course-plans-save-status-invalid-fields")}`
              : null}
          </p>
          <Button
            type="button"
            variant="primary"
            size="medium"
            onClick={onSaveNow}
            disabled={saveStatus.state === "saving"}
            aria-label={t("course-plans-analysis-sticky-save-aria")}
          >
            {saveStatus.state === "saving"
              ? t("course-plans-analysis-saving")
              : t("course-plans-analysis-save-now")}
          </Button>
        </div>
      </div>
    </div>
  )
}
