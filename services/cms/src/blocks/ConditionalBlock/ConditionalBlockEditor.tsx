import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import { fetchCourseInstances } from "../../services/backend/course-instances"
import { fetchCourseModulesByCourseId } from "../../services/backend/courses"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import { assertNotNullOrUndefined } from "../../shared-module/utils/nullability"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ConditionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = [
  "core/heading",
  "core/buttons",
  "core/button",
  "core/paragraph",
  "moocfi/exercise-custom-view-block",
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
                  label={mod.name ?? t("default")}
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
                  label={inst.name ?? t("default")}
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
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default ConditionalBlockEditor
