"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks } from "@wordpress/block-editor"
import React, { useContext } from "react"

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
  clientId,
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

  // set the initial selected value as the previously selected chatbotConfiguration,
  // but if this chatbotConfiguration has been set as default, then it won't be found in
  // the options. in this case, select the first in the list.
  const initialSelected =
    chatbotConfigurationSelectOptions
      .map((o) => o.value)
      .find((v) => v === chatbotConfigurationId) ?? chatbotConfigurationSelectOptions.at(0)?.value
  // set it as the attribute, since if the dropdown contains only one item, then
  // the onChangeByValue event will never fire and they won't be updated.
  setAttributes({
    chatbotConfigurationId: initialSelected,
    courseId: courseId ?? undefined,
  })

  return (
    <BlockPlaceholderWrapper
      id={clientId}
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
