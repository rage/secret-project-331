"use client"

import React from "react"

import type {
  ClientToolAnswer,
  ClientToolName,
} from "@/generated/course-material-api/types.generated"

import MultipleChoiceQuestionBubble from "./MultipleChoiceQuestionBubble"
import {
  ASK_MULTIPLE_CHOICE_QUESTION_TOOL,
  isMultipleChoiceQuestion,
  parseMultipleChoiceQuestion,
} from "./multipleChoiceQuestions"

/** What a call closed with, if it has: absent while `isOpen`. */
export type ClosedClientToolAnswer = { value: unknown } | undefined

export interface ClientToolBubbleProps<TCall> {
  toolCallId: string
  call: TCall
  /** Whether the call is still waiting for the learner. */
  isOpen: boolean
  /** Whether a turn is streaming right now; no answer can be sent while true. */
  isTurnInFlight: boolean
  closedAnswer: ClosedClientToolAnswer
  /** Data a confirmed action tool's execution sent back for this browser only, keyed onto this
   * call by `tool_call_id` when the `ActionExecuted` stream event arrived. `undefined` for a call
   * that never executed (a pure client tool, an unconfirmed action, or one from before reload). */
  executionPayload?: unknown
  onAnswer: (toolCallId: string, toolName: ClientToolName, answer: ClientToolAnswer) => void
}

/** The bubble props a registry entry renders with, before it has narrowed `call` to its own type. */
export type ClientToolRowProps = ClientToolBubbleProps<unknown>

export interface ClientToolRegistryEntry {
  /**
   * Parses and validates a call's raw arguments, or null if this tool cannot make sense of them.
   * A null call renders as an anonymous tool status line instead of `renderBubble`.
   */
  parseCall: (toolCallId: string, toolArguments: string) => unknown | null
  /**
   * Renders the call's bubble. `props.call` is always what this entry's own `parseCall` produced
   * for the same call, so the entry narrows it back to its own type before rendering.
   */
  renderBubble: (props: ClientToolRowProps) => React.ReactNode
}

/**
 * Client tools the frontend knows how to recognize, validate and render, keyed by the name the
 * model calls them with. Each entry owns everything specific to its own argument and answer
 * shape; code that dispatches through this registry only ever sees `unknown`.
 */
export const CLIENT_TOOL_REGISTRY: Record<string, ClientToolRegistryEntry> = {
  [ASK_MULTIPLE_CHOICE_QUESTION_TOOL]: {
    parseCall: parseMultipleChoiceQuestion,
    renderBubble: (props) => {
      if (!isMultipleChoiceQuestion(props.call)) {
        return null
      }
      return <MultipleChoiceQuestionBubble {...props} call={props.call} />
    },
  },
}
