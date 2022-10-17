/* eslint-disable i18next/no-literal-string */
import { useDispatch } from "@wordpress/data"
import { useEffect } from "@wordpress/element"
import { __ } from "@wordpress/i18n"
// @ts-expect-error: No type definitions
import { store as keyboardShortcutsStore, useShortcut } from "@wordpress/keyboard-shortcuts"

const useCommonKeyboardShortcuts = () => {
  const { registerShortcut } = useDispatch(keyboardShortcutsStore)

  useEffect(() => {
    registerShortcut({
      name: "moocfi/save",
      category: "global",
      description: __("Save your changes."),
      keyCombination: {
        modifier: "primary",
        character: "s",
      },
    })

    registerShortcut({
      name: "moocfi/open-saved-page-in-new-tab",
      category: "global",
      description: "Open saved page in new tab",
      keyCombination: {
        modifier: "primary",
        character: "o",
      },
    })

    registerShortcut({
      name: "moocfi/undo",
      category: "global",
      description: __("Undo your last changes."),
      keyCombination: {
        modifier: "primary",
        character: "z",
      },
    })

    registerShortcut({
      name: "moocfi/redo",
      category: "global",
      description: __("Redo your last undo."),
      keyCombination: {
        modifier: "primaryShift",
        character: "z",
      },
    })
  }, [registerShortcut])

  useShortcut("moocfi/save", (e: Event) => {
    e.preventDefault()
    console.info("In the future this should save the page.")
  })

  useShortcut("moocfi/open-saved-page-in-new-tab", (e: Event) => {
    e.preventDefault()
    console.info("In the future this should open the saved page in a new tab.")
  })

  useShortcut("moocfi/undo", (e: Event) => {
    e.preventDefault()
    console.info("In the future this should undo")
  })

  useShortcut("moocfi/redo", (e: Event) => {
    e.preventDefault()
    console.info("In the future this should redo")
  })
}

export default useCommonKeyboardShortcuts
