import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext, useState } from "react"

import PageContext from "../../contexts/PageContext"
import { fetchCourseInstances } from "../../services/backend/course-instances"
import { fetchCourseModulesByCourseId } from "../../services/backend/courses"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import { assertNotNullOrUndefined } from "../../shared-module/utils/nullability"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ConditionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/buttons", "core/button", "core/paragraph"]

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
      title={`Conditional Block`}
      explanation={`This block will be rendered to the student if the student meets all the given condition.`}
    >
      <InspectorControls>
        {courseModules.data && (
          <Wrapper>
            <Text>{`Student has completed any of the following modules:`}</Text>
            {courseModules.data.map((mod) => {
              return (
                <CheckBox
                  key={mod.id}
                  label={mod.name ?? "Default"}
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
            <Text>{`Student has enrolled to any of the following course instances:`}</Text>
            {courseInstances.data.map((inst) => {
              return (
                <CheckBox
                  key={inst.id}
                  label={inst.name ?? "Default"}
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
