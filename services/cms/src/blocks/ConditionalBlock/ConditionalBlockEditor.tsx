import { useQuery } from "@tanstack/react-query"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext, useState } from "react"

import PageContext from "../../contexts/PageContext"
import { fetchCourseInstances } from "../../services/backend/course-instances"
import { fetchCourseModulesByCourseId } from "../../services/backend/courses"
import SelectField from "../../shared-module/components/InputFields/SelectField"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ConditionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/buttons", "core/button", "core/paragraph"]

const ConditionalBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ attributes, clientId, setAttributes }) => {
  const courseId = useContext(PageContext)?.page.course_id
  const courseModules = useQuery({
    queryKey: [`/courses/${courseId}/modules`],
    queryFn: () => fetchCourseModulesByCourseId(courseId as NonNullable<typeof courseId>),
    enabled: !!courseId,
  })

  const courseInstances = useQuery({
    queryKey: [`/courses/${courseId}/course-instances`],
    queryFn: () => fetchCourseInstances(courseId as NonNullable<typeof courseId>),
    enabled: !!courseId,
  })
  console.log(courseInstances, attributes)
  const [requiredModules, setRequiredModules] = useState<string[]>(attributes.module_completion)
  const [requiredInstanceEnrollment, setRequiredInstanceEnrollment] = useState<string[]>(
    attributes.instance_enrollment,
  )
  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={`Conditional Block`}
      explanation={`This block will be rendered to the student if the student meets given condition.`}
    >
      <InspectorControls>
        {courseModules.data && (
          <>
            <SelectField
              options={courseModules.data.map((mod) => {
                return {
                  label: mod.name ?? "Default",
                  value: mod.id,
                }
              })}
              onChange={(e) => {
                const previuoslyChecked = requiredModules.some(
                  (element) => element == e.target.value,
                )
                const newRequiredModules = requiredModules.filter((i) => i != e.target.value)
                if (!previuoslyChecked) {
                  newRequiredModules.push(e.target.value)
                }
                setAttributes({ module_completion: newRequiredModules })
                setRequiredModules(newRequiredModules)
              }}
            ></SelectField>
            <h3>{"Required module completions:"}</h3>
            <ul>
              {requiredModules.map((moduleId) => {
                const moduleName = courseModules.data.find((mod) => {
                  return mod.id == moduleId
                })?.name
                return <li key={moduleId}> {moduleName ?? "Default"} </li>
              })}
            </ul>
          </>
        )}
        {courseInstances.data && (
          <>
            <SelectField
              options={courseInstances.data.map((inst) => {
                return {
                  label: inst.name ?? "Default",
                  value: inst.id,
                }
              })}
              onChange={(e) => {
                const previuoslyChecked = requiredInstanceEnrollment.some(
                  (element) => element == e.target.value,
                )
                const newRequiredInstEnrl = requiredInstanceEnrollment.filter(
                  (i) => i != e.target.value,
                )
                if (!previuoslyChecked) {
                  newRequiredInstEnrl.push(e.target.value)
                }
                setAttributes({ instance_enrollment: newRequiredInstEnrl })
                setRequiredInstanceEnrollment(newRequiredInstEnrl)
              }}
            ></SelectField>
            <h3>{"Required course instance enrollment:"}</h3>
            <ul>
              {requiredInstanceEnrollment.map((instanceId) => {
                const instanceName = courseInstances.data.find((inst) => {
                  return inst.id == instanceId
                })?.name
                return <li key={instanceId}> {instanceName ?? "Default"} </li>
              })}
            </ul>
          </>
        )}
      </InspectorControls>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default ConditionalBlockEditor
