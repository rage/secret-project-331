import { BlockInstance } from "@wordpress/blocks"

import {
  canRedoEditorHistory,
  createEditorHistoryEntry,
  getCurrentEditorHistoryEntry,
  initializeEditorHistory,
  pushEditorHistoryEntry,
  redoEditorHistory,
  undoEditorHistory,
  updateCurrentEditorHistoryEntry,
} from "../../src/utils/Gutenberg/editorHistory"

const createParagraphBlock = (clientId: string, content: string): BlockInstance => ({
  name: "core/paragraph",
  clientId,
  isValid: true,
  attributes: {
    content,
  },
  innerBlocks: [],
})

describe("editorHistory", () => {
  it("updates the current entry for non-persistent changes without adding a new undo step", () => {
    const initialContent = [createParagraphBlock("initial", "A")]
    const persistentContent = [createParagraphBlock("persistent", "AB")]
    const nonPersistentContent = [createParagraphBlock("non-persistent", "ABC")]

    const initialState = initializeEditorHistory(initialContent)
    const persistentState = pushEditorHistoryEntry(
      initialState,
      createEditorHistoryEntry(persistentContent, {
        selectionStart: { clientId: "persistent", offset: 2 },
      }),
    )
    const nonPersistentState = updateCurrentEditorHistoryEntry(
      persistentState,
      createEditorHistoryEntry(nonPersistentContent, {
        selectionStart: { clientId: "non-persistent", offset: 3 },
      }),
    )

    expect(nonPersistentState.entries).toHaveLength(2)
    expect(nonPersistentState.index).toBe(1)
    expect(getCurrentEditorHistoryEntry(nonPersistentState)?.content).toBe(nonPersistentContent)
    expect(getCurrentEditorHistoryEntry(nonPersistentState)?.selection?.selectionStart).toEqual({
      clientId: "non-persistent",
      offset: 3,
    })

    const undoneState = undoEditorHistory(nonPersistentState)
    expect(getCurrentEditorHistoryEntry(undoneState)?.content).toBe(initialContent)

    const redoneState = redoEditorHistory(undoneState)
    expect(getCurrentEditorHistoryEntry(redoneState)?.content).toBe(nonPersistentContent)
  })

  it("drops redo branch when the current entry is updated after undo", () => {
    const initialState = initializeEditorHistory([createParagraphBlock("a", "A")])
    const secondState = pushEditorHistoryEntry(
      initialState,
      createEditorHistoryEntry([createParagraphBlock("b", "B")]),
    )
    const thirdState = pushEditorHistoryEntry(
      secondState,
      createEditorHistoryEntry([createParagraphBlock("c", "C")]),
    )

    const undoneState = undoEditorHistory(thirdState)
    expect(undoneState.entries).toHaveLength(3)

    const updatedState = updateCurrentEditorHistoryEntry(
      undoneState,
      createEditorHistoryEntry([createParagraphBlock("b2", "B2")]),
    )

    expect(updatedState.entries).toHaveLength(2)
    expect(updatedState.index).toBe(1)
    expect(getCurrentEditorHistoryEntry(updatedState)?.content[0].clientId).toBe("b2")
    expect(canRedoEditorHistory(updatedState)).toBe(false)

    const branchedState = pushEditorHistoryEntry(
      updatedState,
      createEditorHistoryEntry([createParagraphBlock("d", "D")]),
    )

    expect(branchedState.entries).toHaveLength(3)
    expect(branchedState.index).toBe(2)
    expect(branchedState.entries.map((entry) => entry.content[0].clientId)).toEqual([
      "a",
      "b2",
      "d",
    ])
  })

  it("drops redo history when a new persistent change is made after undo", () => {
    const initialState = initializeEditorHistory([createParagraphBlock("a", "A")])
    const secondState = pushEditorHistoryEntry(
      initialState,
      createEditorHistoryEntry([createParagraphBlock("b", "B")]),
    )
    const thirdState = pushEditorHistoryEntry(
      secondState,
      createEditorHistoryEntry([createParagraphBlock("c", "C")]),
    )

    const undoneState = undoEditorHistory(thirdState)
    const branchedState = pushEditorHistoryEntry(
      undoneState,
      createEditorHistoryEntry([createParagraphBlock("d", "D")]),
    )

    expect(branchedState.entries).toHaveLength(3)
    expect(branchedState.index).toBe(2)
    expect(branchedState.entries.map((entry) => entry.content[0].clientId)).toEqual(["a", "b", "d"])
  })
})
