"use client"

import { useEffect, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"

import { TextArea } from "@/shared-module/components"

import type { PeerOrSelfReviewQuestionProps } from "."

// oxlint-disable-next-line i18next/no-literal-string
const ANSWER_FIELD = "answer" as const

const EssayPeerOrSelfReviewQuestion: React.FC<
  React.PropsWithChildren<PeerOrSelfReviewQuestionProps>
> = ({
  peerOrSelfReviewQuestion,
  setPeerOrSelfReviewQuestionAnswer,
  peerOrSelfReviewQuestionAnswer,
}) => {
  const label = `${peerOrSelfReviewQuestion.question}${
    peerOrSelfReviewQuestion.answer_required ? " *" : ""
  }`
  const { control } = useForm<{ answer: string }>({
    defaultValues: { answer: peerOrSelfReviewQuestionAnswer?.text_data ?? "" },
  })
  const answer = useWatch({ control, name: ANSWER_FIELD })

  // Skips the mount-time invocation, which would otherwise re-report the seeded default answer.
  const isFirstAnswerEffectRef = useRef(true)
  useEffect(() => {
    if (isFirstAnswerEffectRef.current) {
      isFirstAnswerEffectRef.current = false
      return
    }
    setPeerOrSelfReviewQuestionAnswer({ text_data: answer, number_data: null })
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [answer])

  return (
    <div>
      <TextArea name={ANSWER_FIELD} control={control} label={label} rows={4} autoResize />
    </div>
  )
}

export default EssayPeerOrSelfReviewQuestion
