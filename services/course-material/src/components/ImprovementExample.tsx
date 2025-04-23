/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { animated, useSpring } from "react-spring"

import { parseSentenceDifference } from "../utils/typingDemoSentenceUtils"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

type Phase = "initial" | "mouseMove" | "mouseClick" | "showCaret" | "deleting" | "typing"

interface AnimationState {
  phase: Phase
  displayWord: string
  mouseClicked: boolean
  caretVisible: boolean
  cursorStartPosition: { x: number; y: number }
  cursorTargetPosition: { x: number; y: number }
}

const useImprovementAnimation = (incorrectPart: string, correctPart: string) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrongWordRef = useRef<HTMLSpanElement>(null)

  const [state, setState] = useState<AnimationState>({
    phase: "initial",
    displayWord: incorrectPart,
    mouseClicked: false,
    caretVisible: false,
    cursorStartPosition: { x: 0, y: 0 },
    cursorTargetPosition: { x: 0, y: 0 },
  })

  const resetAnimation = useCallback(() => {
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect()
      setState({
        phase: "initial",
        displayWord: incorrectPart,
        mouseClicked: false,
        caretVisible: false,
        cursorStartPosition: { x: containerRect.width + 20, y: -20 },
        cursorTargetPosition: { x: 0, y: 0 },
      })
    }
  }, [incorrectPart])

  const updateState = (updates: Partial<AnimationState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }

  const mouseSpring = useSpring({
    transform: state.mouseClicked ? "scale(0.5)" : "scale(1)",
    config: { tension: 300, friction: 10 },
  })

  const mouseMoveSpring = useSpring({
    from:
      state.phase === "mouseMove"
        ? { left: state.cursorStartPosition.x, top: state.cursorStartPosition.y }
        : {},
    to: { left: state.cursorTargetPosition.x, top: state.cursorTargetPosition.y },
    config: { tension: 80, friction: 12 },
    immediate: state.phase !== "mouseMove",
  })

  // Caret blinking - only when visible
  useEffect(() => {
    if (state.phase === "showCaret" || state.phase === "deleting" || state.phase === "typing") {
      const blinkInterval = setInterval(() => {
        updateState({ caretVisible: !state.caretVisible })
      }, 500)
      return () => clearInterval(blinkInterval)
    }
  }, [state.phase, state.caretVisible])

  // Initial → mouseMove after 1s
  useEffect(() => {
    if (state.phase === "initial") {
      const timeout = setTimeout(() => {
        updateState({ phase: "mouseMove" })
      }, 1000)
      return () => clearTimeout(timeout)
    }
  }, [state.phase])

  // MouseMove → position cursor near the wrong word
  useEffect(() => {
    if (state.phase === "mouseMove" && wrongWordRef.current && containerRef.current) {
      const rect = wrongWordRef.current.getBoundingClientRect()
      const containerRect = containerRef.current.getBoundingClientRect()

      const targetX = rect.left - containerRect.left + rect.width - 6
      const targetY = rect.top - containerRect.top + rect.height / 2 - 6

      updateState({ cursorTargetPosition: { x: targetX, y: targetY } })

      const timeout = setTimeout(() => {
        updateState({ phase: "mouseClick" })
      }, 1000)
      return () => clearTimeout(timeout)
    }
  }, [state.phase])

  // Click animation → show caret
  useEffect(() => {
    if (state.phase === "mouseClick") {
      updateState({ mouseClicked: true })
      const timeout = setTimeout(() => {
        updateState({ mouseClicked: false, phase: "showCaret" })
      }, 300)
      return () => clearTimeout(timeout)
    }
  }, [state.phase])

  // Show caret → start deleting
  useEffect(() => {
    if (state.phase === "showCaret") {
      updateState({ caretVisible: true })
      const timeout = setTimeout(() => {
        updateState({ phase: "deleting" })
      }, 500)
      return () => clearTimeout(timeout)
    }
  }, [state.phase])

  // Deleting wrong word
  useEffect(() => {
    if (state.phase === "deleting") {
      if (state.displayWord.length > 0) {
        const interval = setInterval(() => {
          updateState({ displayWord: state.displayWord.slice(0, -1) })
        }, 100)
        return () => clearInterval(interval)
      } else {
        const timeout = setTimeout(() => {
          updateState({ phase: "typing" })
        }, 400)
        return () => clearTimeout(timeout)
      }
    }
  }, [state.phase, state.displayWord])

  // Typing correct word
  useEffect(() => {
    if (state.phase === "typing") {
      if (state.displayWord.length < correctPart.length) {
        const interval = setInterval(() => {
          updateState({ displayWord: correctPart.slice(0, state.displayWord.length + 1) })
        }, 100)
        return () => clearInterval(interval)
      } else {
        const timeout = setTimeout(() => {
          resetAnimation()
        }, 2000)
        return () => clearTimeout(timeout)
      }
    }
  }, [state.phase, state.displayWord, correctPart, resetAnimation])

  return {
    state,
    containerRef,
    wrongWordRef,
    mouseSpring,
    mouseMoveSpring,
  }
}

const ImprovementExample: React.FC = () => {
  const { t } = useTranslation()

  // Get translated versions of the sentences
  const incorrectSentence = t("improvement-example-incorrect-sentence")
  const correctSentence = t("improvement-example-correct-sentence")

  // English fallbacks
  const englishIncorrect = "The small brown fox jumps over the lazy dog."
  const englishCorrect = "The quick brown fox jumps over the lazy dog."

  // Parse the sentences to extract components, with fallback to English
  const { prefix, incorrectPart, correctPart, suffix } = parseSentenceDifference(
    incorrectSentence,
    correctSentence,
    englishIncorrect,
    englishCorrect,
  )

  const { state, containerRef, wrongWordRef, mouseSpring, mouseMoveSpring } =
    useImprovementAnimation(incorrectPart, correctPart)

  return (
    <div
      className={css`
        position: relative;
        margin: 1rem 0;
      `}
      aria-hidden="true"
    >
      <div
        className={css`
          position: absolute;
          top: -0.75rem;
          left: 1rem;
          background: white;
          padding: 0.125rem 0.5rem;
          font-size: 0.75rem;
          color: ${baseTheme.colors.gray[600]};
          border: 1px solid ${baseTheme.colors.gray[200]};
          border-radius: 8px;
          z-index: 1;

          ${respondToOrLarger.xs} {
            font-size: 0.875rem;
            padding: 0.25rem 0.75rem;
          }
        `}
      >
        {t("label-example")}
      </div>
      <div
        ref={containerRef}
        className={css`
          background: white;
          color: ${baseTheme.colors.gray[700]};
          font-size: 0.875rem;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 0.75rem;
          border-radius: 4px;
          border: 1px solid ${baseTheme.colors.gray[200]};
          pointer-events: none;
          min-height: 40px;
          overflow: visible;
          white-space: normal;
          text-align: center;
          gap: 0.25rem;

          ${respondToOrLarger.xs} {
            font-size: 1rem;
            padding: 1rem;
            min-height: 50px;
            white-space: pre;
            gap: 0;
          }

          span {
            margin: 0;
            display: inline-block;
          }

          .caret {
            margin: 0;
          }
        `}
      >
        <span>{prefix}</span>
        <span ref={wrongWordRef}>{state.displayWord}</span>
        {(state.phase === "showCaret" ||
          state.phase === "deleting" ||
          state.phase === "typing") && (
          <span
            className={css`
              opacity: ${state.caretVisible ? 1 : 0};
              transition: opacity 0.1s;
              margin: 0;
            `}
          >
            |
          </span>
        )}
        <span>{suffix}</span>

        {(state.phase === "mouseMove" || state.phase === "mouseClick") && (
          <animated.div
            style={{
              ...mouseSpring,
              ...mouseMoveSpring,
              position: "absolute",
              width: "12px",
              height: "12px",
              background: "#333",
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 10,
              transformOrigin: "center",
            }}
          />
        )}
      </div>
    </div>
  )
}

export default ImprovementExample
