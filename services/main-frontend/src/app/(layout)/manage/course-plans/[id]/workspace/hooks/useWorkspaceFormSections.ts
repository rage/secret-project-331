"use client"

import type { ParseKeys } from "i18next"
import type { ComponentType } from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { sectionAccentByIndex } from "../components/analysis-form/analysisFormDomain"
import useWorkspaceSectionNav from "./useWorkspaceSectionNav"

interface WorkspaceFormSectionDefinition {
  domId: string
  titleKey: ParseKeys
  icon: ComponentType<{ size?: number | string }>
}

/**
 * Section navigation for a stage form, with the toolbar links and each `WorkspaceFormSection`'s
 * props. `sections` must be stable (a module-level array).
 */
export default function useWorkspaceFormSections(
  sections: readonly WorkspaceFormSectionDefinition[],
  isReadOnly: boolean,
) {
  const { t } = useTranslation()
  const sectionDomIds = useMemo(() => sections.map((section) => section.domId), [sections])
  const sectionNav = useWorkspaceSectionNav(sectionDomIds)

  const sectionLinks = sections.map((section) => ({
    domId: section.domId,
    title: t(section.titleKey),
  }))

  const sectionProps = (index: number) => {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- index is within sections
    const section = sections[index]!
    return {
      domId: section.domId,
      icon: section.icon,
      title: t(section.titleKey),
      accentClassName: sectionAccentByIndex[index % sectionAccentByIndex.length] ?? "",
      expanded: sectionNav.isExpanded(section.domId),
      onToggle: () => sectionNav.toggleSection(section.domId),
      isReadOnly,
    }
  }

  return { sectionNav, sectionLinks, sectionProps }
}
