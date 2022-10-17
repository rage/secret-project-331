import useCommonKeyboardShortcuts from "../hooks/useCommonKeyboardShortCuts"

const CommonKeyboardShortcuts: React.FC = () => {
  // We call the hook in a component so that the hook is used only inside a ShortCutProvider.
  useCommonKeyboardShortcuts()
  return null
}

export default CommonKeyboardShortcuts
