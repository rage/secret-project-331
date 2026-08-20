"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks } from "@wordpress/block-editor"
import React, { useContext, useEffect } from "react"

import { getCmsCourseNondefaultChatbotConfigurationsOptions } from "@/generated/api/@tanstack/react-query.generated"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ChatbotBlockAttributes } from "."
import PageContext from "../../contexts/PageContext"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [""]

const ChatbotEditor: React.FC<React.PropsWithChildren<BlockEditProps<ChatbotBlockAttributes>>> = ({
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()
  const courseId = useContext(PageContext)?.page.course_id

  const chatbotConfigurations = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getCmsCourseNondefaultChatbotConfigurationsOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )
  const chatbotConfigurationSelectOptions: { label: string; value: string }[] = [
    ...(chatbotConfigurations.data?.map((c) => ({ label: c.chatbot_name, value: c.id })) ?? []),
  ]

  const { chatbotConfigurationId } = attributes

  // A chatbotConfiguration that has since been made the course default is no longer among the
  // options, so fall back to the first one.
  const initialSelected =
    chatbotConfigurationSelectOptions
      .map((o) => o.value)
      .find((v) => v === chatbotConfigurationId) ?? chatbotConfigurationSelectOptions.at(0)?.value
  const resolvedCourseId = courseId ?? undefined

  // The dropdown never fires onChangeByValue when it holds a single option, so the attributes have
  // to be seeded here. Writing only on a real change keeps this out of the undo history and off the
  // unsaved-changes flag; waiting for the query keeps it from clearing a stored id while loading.
  useEffect(() => {
    if (chatbotConfigurations.data === undefined) {
      return
    }
    if (initialSelected === chatbotConfigurationId && resolvedCourseId === attributes.courseId) {
      return
    }
    setAttributes({ chatbotConfigurationId: initialSelected, courseId: resolvedCourseId })
  }, [
    attributes.courseId,
    chatbotConfigurationId,
    chatbotConfigurations.data,
    initialSelected,
    resolvedCourseId,
    setAttributes,
  ])

  return (
    <BlockPlaceholderWrapper
      title={t("chatbot-block-placeholder")}
      explanation={t("chatbot-block-placeholder-explanation")}
    >
      <QueryResult
        query={chatbotConfigurations}
        emptyFallback={<p>{t("no-chatbots-for-course")}</p>}
      >
        {() => (
          <SelectField
            className={css`
              width: inherit;
            `}
            label={t("select-an-option")}
            options={chatbotConfigurationSelectOptions}
            defaultValue={initialSelected}
            onChangeByValue={(v) => {
              setAttributes({
                chatbotConfigurationId: v,
                courseId: courseId ?? undefined,
              })
            }}
          />
        )}
      </QueryResult>

      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default ChatbotEditor
