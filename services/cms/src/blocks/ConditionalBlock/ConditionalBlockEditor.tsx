import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import { fetchCourseInstances } from "../../services/backend/course-instances"
import { fetchCourseModulesByCourseId } from "../../services/backend/courses"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ConditionAttributes } from "."

import InnerBlocksWrapper from "@/components/blocks/InnerBlocksWrapper"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const ALLOWED_NESTED_BLOCKS = [
  "core/heading",
  "core/buttons",
  "core/button",
  "core/paragraph",
  "moocfi/exercise-custom-view-block",
  "moocfi/aside",
  "moocfi/chapter-progress",
  "moocfi/congratulations",
  "moocfi/course-chapter-grid",
  "moocfi/course-progress",
  "moocfi/exercise-slide",
  "moocfi/exercise-task",
  "moocfi/exercise-slides",
  "moocfi/exercise-settings",
  "moocfi/exercises-in-chapter",
  "moocfi/glossary",
  "moocfi/infobox",
  "moocfi/latex",
  "moocfi/learning-objectives",
  "moocfi/pages-in-chapter",
  "moocfi/unsupported-block-type",
  "moocfi/highlightbox",
  "moocfi/instructionbox",
  "moocfi/tablebox",
  "moocfi/iframe",
  "moocfi/map",
  "moocfi/author",
  "moocfi/author-inner-block",
  "moocfi/conditional-block",
  "moocfi/exercise-custom-view-block",
  "moocfi/top-level-pages",
  "moocfi/expandable-content",
  "moocfi/expandable-content-inner-block",
  "moocfi/revelable-content",
  "moocfi/revealable-hidden-content",
  "moocfi/aside-with-image",
  "moocfi/flip-card",
  "moocfi/front-card",
  "moocfi/back-card",
  "moocfi/code-giveaway",
  "moocfi/ingress",
  "moocfi/terminology-block",
]

const Wrapper = styled.div`
  margin-left: 1rem;
  margin-right: 1rem;
  height: auto;
`
const Text = styled.p`
  padding-bottom: 1rem;
`

const ConditionalBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ attributes, clientId, setAttributes }) => {
  const { t } = useTranslation()
  const courseId = useContext(PageContext)?.page.course_id
  const courseModules = useQuery({
    queryKey: [`/courses/${courseId}/modules`],
    queryFn: () => fetchCourseModulesByCourseId(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })

  const courseInstances = useQuery({
    queryKey: [`/courses/${courseId}/course-instances`],
    queryFn: () => fetchCourseInstances(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
  const [requiredModules, setRequiredModules] = useState<string[]>(attributes.module_completion)
  const [requiredInstanceEnrollment, setRequiredInstanceEnrollment] = useState<string[]>(
    attributes.instance_enrollment,
  )
  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("conditional-block")}
      explanation={t("conditional-block-explanation")}
    >
      <InspectorControls>
        {courseModules.data && (
          <Wrapper>
            <Text>{t("module-completion-condition")}</Text>
            {courseModules.data.map((mod) => {
              return (
                <CheckBox
                  key={mod.id}
                  label={mod.name ?? t("label-default")}
                  value={mod.id}
                  onChange={() => {
                    const previuoslyChecked = requiredModules.some((modId) => modId == mod.id)
                    const newRequiredModules = requiredModules.filter((i) => i != mod.id)
                    if (!previuoslyChecked) {
                      newRequiredModules.push(mod.id)
                    }
                    setAttributes({ module_completion: newRequiredModules })
                    setRequiredModules(newRequiredModules)
                  }}
                  checked={requiredModules.some((modId) => modId == mod.id)}
                ></CheckBox>
              )
            })}
          </Wrapper>
        )}
        {courseInstances.data && (
          <Wrapper>
            <Text>{t("course-instance-enrollment-condition")}</Text>
            {courseInstances.data.map((inst) => {
              return (
                <CheckBox
                  key={inst.id}
                  label={inst.name ?? t("label-default")}
                  value={inst.id}
                  onChange={() => {
                    const previuoslyChecked = requiredInstanceEnrollment.some(
                      (instId) => instId == inst.id,
                    )
                    const newRequiredInstEnrl = requiredInstanceEnrollment.filter(
                      (i) => i != inst.id,
                    )
                    if (!previuoslyChecked) {
                      newRequiredInstEnrl.push(inst.id)
                    }
                    setAttributes({ instance_enrollment: newRequiredInstEnrl })
                    setRequiredInstanceEnrollment(newRequiredInstEnrl)
                  }}
                  checked={requiredInstanceEnrollment.some((instId) => instId == inst.id)}
                ></CheckBox>
              )
            })}
          </Wrapper>
        )}
      </InspectorControls>
      <InnerBlocksWrapper title={t("conditionally-shown-content")}>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </InnerBlocksWrapper>
    </BlockPlaceholderWrapper>
  )
}

export default ConditionalBlockEditor
