"use client"

import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import React, { useContext, useEffect, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"

import InnerBlocksWrapper from "@/components/blocks/InnerBlocksWrapper"
import { getCmsCodeGiveawaysByCourseOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { SelectOption } from "@/shared-module/components/components/Select"
import { Select } from "@/shared-module/components/components/Select"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ConditionAttributes } from "."
import PageContext from "../../contexts/PageContext"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [
  "core/heading",
  "core/buttons",
  "core/button",
  "core/paragraph",
  "core/image",
  "core/embed",
]

const CODE_GIVEAWAY_FIELD_NAME = "codeGiveawayId" as const
/** code-giveaway.spec.ts locates the select by this; its accessible name changes with the value. */
const CODE_GIVEAWAY_SELECT_ID = "code-giveaway-select"

interface CodeGiveawayFormValues {
  codeGiveawayId: string
}

const Wrapper = styled.div`
  margin-left: 1rem;
  margin-right: 1rem;
  height: auto;
`

interface CodeGiveawaySelectProps {
  options: SelectOption[]
  codeGiveawayId: string
  setCodeGiveawayId: (codeGiveawayId: string) => void
}

/**
 * Picks the giveaway a `moocfi/code-giveaway` block shows, from the block inspector.
 *
 * Adapts the block attribute (not form state) to `components`' RHF-only `Select` via a local form
 * kept in sync with it in both directions. Keep it below the block edit component: the form
 * re-renders on mount, and customBlocks.test.tsx asserts every block edit settles in one render.
 */
const CodeGiveawaySelect: React.FC<CodeGiveawaySelectProps> = ({
  options,
  codeGiveawayId,
  setCodeGiveawayId,
}) => {
  const { t } = useTranslation()
  const { control, getValues, setValue, subscribe } = useForm<CodeGiveawayFormValues>({
    defaultValues: { [CODE_GIVEAWAY_FIELD_NAME]: codeGiveawayId },
  })

  // The setter is a new function every render. Reading it through a ref keeps the subscribe effect
  // below mounted for the component's lifetime instead of tearing the subscription down and
  // rebuilding it on every render of the block.
  const setCodeGiveawayIdRef = useRef(setCodeGiveawayId)
  setCodeGiveawayIdRef.current = setCodeGiveawayId

  // setValue only reaches the subscriber below when it actually changes the value. This flag marks
  // that change as external so the subscriber does not echo it back into Gutenberg as a fresh
  // attribute change.
  const isSyncingFromAttributeRef = useRef(false)

  useEffect(() => {
    if (getValues(CODE_GIVEAWAY_FIELD_NAME) === codeGiveawayId) {
      return
    }
    isSyncingFromAttributeRef.current = true
    setValue(CODE_GIVEAWAY_FIELD_NAME, codeGiveawayId)
  }, [codeGiveawayId, getValues, setValue])

  useEffect(() => {
    return subscribe({
      name: CODE_GIVEAWAY_FIELD_NAME,
      formState: { values: true },
      callback: ({ values }) => {
        if (isSyncingFromAttributeRef.current) {
          isSyncingFromAttributeRef.current = false
          return
        }
        setCodeGiveawayIdRef.current(values[CODE_GIVEAWAY_FIELD_NAME])
      },
    })
  }, [subscribe])

  return (
    <Select
      control={control}
      name={CODE_GIVEAWAY_FIELD_NAME}
      id={CODE_GIVEAWAY_SELECT_ID}
      label={t("code-giveaway")}
      options={options}
    />
  )
}

const CodeGiveawayBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ attributes, setAttributes }) => {
  const { t } = useTranslation()
  const courseId = useContext(PageContext)?.page.course_id

  const codeGivawayQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getCmsCodeGiveawaysByCourseOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )

  const title = useMemo(() => {
    let computedTitle = t("code-giveaway")
    if (codeGivawayQuery.data) {
      const selected = codeGivawayQuery.data.find((o) => o.id === attributes.code_giveaway_id)
      if (selected) {
        computedTitle += ` (${selected.name})`
      }
    }
    return computedTitle
  }, [attributes.code_giveaway_id, codeGivawayQuery.data, t])

  const dropdownOptions = useMemo(() => {
    const res = [{ label: t("select-an-option"), value: "" }]
    if (!codeGivawayQuery.data) {
      return res
    }
    const additional = codeGivawayQuery.data.map((o) => ({
      label: o.name,
      value: o.id,
    }))
    return res.concat(additional)
  }, [codeGivawayQuery.data, t])

  return (
    <BlockPlaceholderWrapper title={title} explanation={t("code-giveaway-explanation")}>
      <InspectorControls>
        {/* Mounting the select before the giveaways arrive would show an already selected giveaway
            as the placeholder, which is what a value with no matching option renders as. */}
        {codeGivawayQuery.data && (
          <Wrapper>
            <CodeGiveawaySelect
              options={dropdownOptions}
              codeGiveawayId={attributes.code_giveaway_id}
              setCodeGiveawayId={(codeGiveawayId) =>
                setAttributes({ code_giveaway_id: codeGiveawayId })
              }
            />
          </Wrapper>
        )}
      </InspectorControls>
      <InnerBlocksWrapper title={t("instructions")}>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </InnerBlocksWrapper>
    </BlockPlaceholderWrapper>
  )
}

export default CodeGiveawayBlockEditor
