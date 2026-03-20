/* eslint-disable i18next/no-literal-string */
"use client"

import { useDispatch } from "@wordpress/data"
import { useEffect } from "@wordpress/element"
// @ts-expect-error: No type definitions
import { store as keyboardShortcutsStore, useShortcut } from "@wordpress/keyboard-shortcuts"
import { useTranslation } from "react-i18next"

interface UseCommonKeyboardShortcutsProps {
  onUndo?: () => void
  onRedo?: () => void
}

const shouldHandleBlockEditorHistoryShortcut = (event: Event): boolean => {
  const target = event.target

  return !(
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

const useCommonKeyboardShortcuts = ({ onUndo, onRedo }: UseCommonKeyboardShortcutsProps = {}) => {
  const { registerShortcut } = useDispatch(keyboardShortcutsStore)
  const { t } = useTranslation()

  useEffect(() => {
    registerShortcut({
      name: "moocfi/undo",
      category: "global",
      description: t("undo-your-last-changes"),
      keyCombination: {
        modifier: "primary",
        character: "z",
      },
    })

    registerShortcut({
      name: "moocfi/redo",
      category: "global",
      description: t("redo-your-last-undo"),
      keyCombination: {
        modifier: "primaryShift",
        character: "z",
      },
      aliases: [
        {
          modifier: "primary",
          character: "y",
        },
      ],
    })
  }, [registerShortcut, t])

  useShortcut("moocfi/undo", (e: Event) => {
    if (!onUndo || !shouldHandleBlockEditorHistoryShortcut(e)) {
      return
    }

    e.preventDefault()
    onUndo()
  })

  useShortcut("moocfi/redo", (e: Event) => {
    if (!onRedo || !shouldHandleBlockEditorHistoryShortcut(e)) {
      return
    }

    e.preventDefault()
    onRedo()
  })
}

export default useCommonKeyboardShortcuts
