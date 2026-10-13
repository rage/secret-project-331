"use client"

import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import React, { useContext } from "react"

import InnerBlocksWrapper from "@/components/blocks/InnerBlocksWrapper"
import {
  getCmsCourseInstancesOptions,
  getCmsCourseModulesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { Checkbox } from "@/shared-module/components"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useAttributeForm } from "@/utils/useAttributeForm"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ConditionAttributes } from "."
import PageContext from "../../contexts/PageContext"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

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
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </InnerBlocksWrapper>
    </BlockPlaceholderWrapper>
  )
}

export default ConditionalBlockEditor
