import { atom, useAtom, useSetAtom } from "jotai"
import { SetStateAction, useEffect } from "react"

import { courseMaterialBlockClass } from "../utils/constants"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"

type CurrentlyOpenFeedbackDialog = "written" | "proposed-edits" | "select-type" | null

interface SelectionState {
  text: string
  position: { x: number; y: number } | null
}

/** Manages block selection in the DOM */
type BlockIdListener = {
  getCurrentBlockId: () => string | null
  cleanup: () => void
}

/** Base interface for feedback store return types */
interface BaseFeedbackStore {
  setCurrentlyOpenFeedbackDialog: (type: CurrentlyOpenFeedbackDialog) => void
  selection: SelectionState
  setSelection: (text: string, position: { x: number; y: number } | null) => void
}

interface NotGivingFeedbackStore extends BaseFeedbackStore {
  type: null
}

interface WrittenFeedbackStore extends BaseFeedbackStore {
  type: "written"
  content: string
  setWrittenContent: (content: string) => void
}

interface ProposedEditsFeedbackStore extends BaseFeedbackStore {
  type: "proposed-edits"
  blockEdits: Map<string, NewProposedBlockEdit>
  selectedBlockId: string | null
  setBlockEdits: (edits: SetStateAction<Map<string, NewProposedBlockEdit>>) => void
  setSelectedBlockId: (blockId: string | null) => void
}

interface SelectTypeFeedbackStore extends BaseFeedbackStore {
  type: "select-type"
}

type FeedbackStore =
  | NotGivingFeedbackStore
  | WrittenFeedbackStore
  | ProposedEditsFeedbackStore
  | SelectTypeFeedbackStore

/** Sets up DOM event listener to track currently selected block */
const setupBlockIdListener = (): BlockIdListener => {
  let currentBlockId: string | null = document.activeElement?.id ?? null
  const abortController = new AbortController()

  const getState = (): string | null => currentBlockId

  const handleClick = (ev: MouseEvent): void => {
    if (ev.target instanceof Element) {
      let newBlockId = null
      let element: Element | null = ev.target
      while (element !== null) {
        if (element.classList.contains(courseMaterialBlockClass)) {
          newBlockId = element.id
          break
        }
        element = element.parentElement
      }
      currentBlockId = newBlockId
    } else {
      currentBlockId = null
    }
  }

  document.addEventListener("click", handleClick, { signal: abortController.signal })

  return {
    getCurrentBlockId: getState,
    cleanup: () => {
      abortController.abort()
    },
  }
}

/** Core state atoms */
const currentlyOpenFeedbackDialogAtom = atom<CurrentlyOpenFeedbackDialog>(null)
const writtenContentAtom = atom<string>("")
const blockEditsAtom = atom<Map<string, NewProposedBlockEdit>>(new Map())
const selectedBlockIdAtom = atom<string | null>(null)
const selectionAtom = atom<SelectionState>({ text: "", position: null })
const refCountAtom = atom(0)

/** DOM listener state */
const listenerInstanceAtom = atom<BlockIdListener | null>(null)
const observerAtom = atom<MutationObserver | null>(null)

/** Sets up DOM listeners for tracking selected blocks */
const setupListenersAtom = atom(null, (get, set) => {
  let listener = get(listenerInstanceAtom)
  if (listener) {
    return
  }

  listener = setupBlockIdListener()
  set(listenerInstanceAtom, listener)

  const observer = new MutationObserver(() => {
    const currentDialog = get(currentlyOpenFeedbackDialogAtom)
    if (currentDialog !== "proposed-edits") {
      return
    }

    set(selectedBlockIdAtom, listener?.getCurrentBlockId() ?? null)
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  set(observerAtom, observer)
})

/** Cleans up DOM listeners */
const cleanupListenersAtom = atom(null, (get, set) => {
  const refCount = get(refCountAtom)
  if (refCount <= 1) {
    const observer = get(observerAtom)
    if (observer) {
      observer.disconnect()
      set(observerAtom, null)
    }

    const listener = get(listenerInstanceAtom)
    if (listener) {
      listener.cleanup()
      set(listenerInstanceAtom, null)
    }
  }
})

/** Sets the currently open feedback dialog and handles setup/cleanup */
const setCurrentlyOpenFeedbackDialogAtom = atom(
  null,
  (get, set, type: CurrentlyOpenFeedbackDialog) => {
    switch (type) {
      case "written":
        set(setupListenersAtom)
        set(currentlyOpenFeedbackDialogAtom, "written")
        set(writtenContentAtom, "")
        break
      case "proposed-edits":
        set(setupListenersAtom)
        set(currentlyOpenFeedbackDialogAtom, "proposed-edits")
        set(blockEditsAtom, new Map())
        set(selectedBlockIdAtom, get(listenerInstanceAtom)?.getCurrentBlockId() ?? null)
        break
      case "select-type":
        set(currentlyOpenFeedbackDialogAtom, "select-type")
        break
      default:
        set(cleanupListenersAtom)
        set(currentlyOpenFeedbackDialogAtom, null)
    }
  },
)

/** Updates written feedback content */
const setWrittenContentAtom = atom(null, (get, set, content: string) => {
  const currentDialog = get(currentlyOpenFeedbackDialogAtom)
  if (currentDialog === "written") {
    set(writtenContentAtom, content)
  }
})

/** Updates proposed block edits */
const setBlockEditsAtom = atom(
  null,
  (get, set, edits: SetStateAction<Map<string, NewProposedBlockEdit>>) => {
    const currentDialog = get(currentlyOpenFeedbackDialogAtom)
    if (currentDialog !== "proposed-edits") {
      return
    }

    const currentEdits = get(blockEditsAtom)
    if (typeof edits === "function") {
      set(blockEditsAtom, edits(currentEdits))
    } else {
      set(blockEditsAtom, edits)
    }
  },
)

/** Updates selected block ID */
const setSelectedBlockIdAtom = atom(null, (get, set, blockId: string | null) => {
  const currentDialog = get(currentlyOpenFeedbackDialogAtom)
  if (currentDialog === "proposed-edits") {
    set(selectedBlockIdAtom, blockId)
  }
})

/** Updates selection state */
const setSelectionAtom = atom(
  null,
  (_get, set, text: string, position: { x: number; y: number } | null) => {
    set(selectionAtom, { text, position })
  },
)

/** Hook for managing course material feedback state */
export const useFeedbackStore = (): FeedbackStore => {
  const [currentDialog] = useAtom(currentlyOpenFeedbackDialogAtom)
  const [writtenContent] = useAtom(writtenContentAtom)
  const [blockEdits] = useAtom(blockEditsAtom)
  const [selectedBlockId] = useAtom(selectedBlockIdAtom)
  const [selection] = useAtom(selectionAtom)
  const setCurrentlyOpenFeedbackDialog = useSetAtom(setCurrentlyOpenFeedbackDialogAtom)
  const setWrittenContent = useSetAtom(setWrittenContentAtom)
  const setBlockEdits = useSetAtom(setBlockEditsAtom)
  const setSelectedBlockId = useSetAtom(setSelectedBlockIdAtom)
  const setSelection = useSetAtom(setSelectionAtom)
  const setRefCount = useSetAtom(refCountAtom)

  useEffect(() => {
    setRefCount((prev) => prev + 1)
    return () => {
      setRefCount((prev) => {
        const newCount = prev - 1
        if (newCount === 0 && currentDialog !== null) {
          setCurrentlyOpenFeedbackDialog(null)
        }
        return newCount
      })
    }
  }, [currentDialog, setRefCount, setCurrentlyOpenFeedbackDialog])

  const baseStore = {
    setCurrentlyOpenFeedbackDialog,
    selection,
    setSelection,
  }

  if (currentDialog === "written") {
    return {
      ...baseStore,
      type: currentDialog,
      content: writtenContent,
      setWrittenContent,
    }
  } else if (currentDialog === "proposed-edits") {
    return {
      ...baseStore,
      type: currentDialog,
      blockEdits,
      selectedBlockId,
      setBlockEdits,
      setSelectedBlockId,
    }
  } else if (currentDialog === "select-type") {
    return {
      ...baseStore,
      type: currentDialog,
    }
  } else {
    return {
      ...baseStore,
      type: currentDialog,
    }
  }
}
