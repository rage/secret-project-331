"use client"

import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { InspectorControls } from "@wordpress/block-editor"
import React, { useContext } from "react"

import InnerBlocksWrapper from "@/components/blocks/InnerBlocksWrapper"
import {
  getCmsCourseInstancesOptions,
  getCmsCourseModulesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { Checkbox } from "@/shared-module/components"
import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useAttributeForm } from "@/utils/useAttributeForm"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ConditionAttributes } from "."
import PageContext from "../../contexts/PageContext"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: var(--space-4);
  height: auto;
`
const Text = styled.p`
  margin: 0;
`

interface RequiredConditions {
  modules: Record<string, boolean>
  instances: Record<string, boolean>
}

const toCheckedMap = (ids: string[]): Record<string, boolean> =>
  Object.fromEntries(ids.map((id) => [id, true]))

const toCheckedIds = (checked: Record<string, boolean>): string[] =>
  Object.keys(checked).filter((id) => checked[id])

const ConditionalBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ attributes, setAttributes }) => {
  const { t } = useTranslation()
  const courseId = useContext(PageContext)?.page.course_id
  const courseModules = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getCmsCourseModulesOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )

  const courseInstances = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getCmsCourseInstancesOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )
  const { control } = useAttributeForm<RequiredConditions>(
    {
      modules: toCheckedMap(attributes.module_completion),
      instances: toCheckedMap(attributes.instance_enrollment),
    },
    (values, changedName) => {
      if (changedName.startsWith("modules.")) {
        setAttributes({ module_completion: toCheckedIds(values.modules) })
      } else {
        setAttributes({ instance_enrollment: toCheckedIds(values.instances) })
      }
    },
  )
  return (
    <BlockPlaceholderWrapper
      title={t("conditional-block")}
      explanation={t("conditional-block-explanation")}
    >
      <InspectorControls>
        {courseModules.data && (
          <Wrapper>
            <Text>{t("module-completion-condition")}</Text>
            {courseModules.data.map((mod) => {
              return (
                <Checkbox
                  key={mod.id}
                  name={`modules.${mod.id}`}
                  control={control}
                  label={mod.name ?? t("label-default")}
                />
              )
            })}
          </Wrapper>
        )}
        {courseInstances.data && (
          <Wrapper>
            <Text>{t("course-instance-enrollment-condition")}</Text>
            {courseInstances.data.map((inst) => {
              return (
                <Checkbox
                  key={inst.id}
                  name={`instances.${inst.id}`}
                  control={control}
                  label={inst.name ?? t("label-default")}
                />
              )
            })}
          </Wrapper>
        )}
      </InspectorControls>
      <InnerBlocksWrapper title={t("conditionally-shown-content")}>
        <RegisteredInnerBlocks />
      </InnerBlocksWrapper>
    </BlockPlaceholderWrapper>
  )
}

export default ConditionalBlockEditor
