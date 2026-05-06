"use client"

import useCommonKeyboardShortcuts from "../hooks/useCommonKeyboardShortCuts"

interface CommonKeyboardShortcutsProps {
  onUndo?: () => void
  onRedo?: () => void
}

const CommonKeyboardShortcuts: React.FC<CommonKeyboardShortcutsProps> = ({ onUndo, onRedo }) => {
  // We call the hook in a component so that the hook is used only inside a ShortCutProvider.
  useCommonKeyboardShortcuts({ onUndo, onRedo })
  return null
}

export default CommonKeyboardShortcuts
