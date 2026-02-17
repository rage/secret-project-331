# AnswerBrowserExercise refactoring plan

Goal: make the file **readable**, **extensible**, and **maintainable** by separating concerns, extracting reusable pieces, and keeping the main component as a thin orchestrator.

---

## 1. Current issues

- **Single large file (~506 lines)**  
  Styled components, icons, utils, state, and JSX all live in one place. Hard to scan and to change one concern without touching others.

- **Mixed concerns in one component**  
  Editor state, run output, test run, reset confirm, and output panel content are all in `AnswerBrowserExercise`. Adding a new feature (e.g. “Submit”) increases complexity in the same blob.

- **Styled components and icons in the same file as logic**  
  ~220 lines of styles/icons make the main component and data flow harder to follow.

- **Inline handlers and derived state**  
  Run/test/reset logic and output-panel branching are inline. Reusing or testing them is difficult.

- **No clear separation between “layout” and “behavior”**  
  Reading the JSX requires jumping between structure, conditions, and callbacks.

---

## 2. Target structure (high level)

```
components/
  AnswerBrowserExercise/
    index.tsx                    # Public export; composes subcomponents and hooks
    AnswerBrowserExercise.tsx    # Main orchestrator (optional: keep name, slim body)
    types.ts                     # Props, shared types
    styles.ts                    # All Emotion styled components
    icons.tsx                    # Play, Stop, Eye SVGs
    hooks/
      useEditorState.ts          # editorFiles, setEditorState, originalStateRef, editorKey, reset
      useRunOutput.ts            # runOutput, runError, pyodideLoading, runExecuting, handleRunPython
      useTestRun.ts              # testResults, testInProgress, handleRunTests
    components/
      EditorSection.tsx          # Editor wrapper + Monaco
      ActionButtons.tsx          # Run / Stop / Test / Reset
      ResetConfirmDialog.tsx     # Overlay + "Are you sure?" + Cancel/OK
      OutputPanel.tsx            # Container + header + body; decides run vs test content
      RunOutputContent.tsx       # Pre with run output / loading / error
      TestResultsContent.tsx     # List of TestResultCard or status+logs
      TestResultCard.tsx         # Single PASS/FAIL card
    utils/
      extensionToLanguage.ts     # filepath → Monaco language
      formatLogsForDisplay.ts    # logs record → string
```

The main file (`index.tsx` or `AnswerBrowserExercise.tsx`) should be ~80–120 lines: hooks + composition of `<EditorSection>`, `<ActionButtons>`, `<ResetConfirmDialog>`, `<OutputPanel>`.

---

## 3. Refactoring steps (in order)

### Phase A: Extract without changing behavior

1. **Create `AnswerBrowserExercise/` directory**
   - Add `index.tsx` that re-exports the current component (so existing imports keep working).
   - Move current `AnswerBrowserExercise.tsx` into this folder (or rename and use as the main component file).

2. **Extract styles**
   - New file: `AnswerBrowserExercise/styles.ts`.
   - Move all `styled.*` components (Card, EditorSection, EditorWrapper, ButtonRow, RunButton, StopButton, TestButton, ResetButton, ConfirmOverlay, ConfirmDialog, ConfirmMessage, ConfirmButtons, TestButtonLabel, OutputContainer, OutputHeader, OutputHeaderText, OutputBody, OutputPre, TestResultCard, TestResultHeader, TestResultMessage).
   - Export them.
   - In the main component, import from `./styles`.

3. **Extract icons**
   - New file: `AnswerBrowserExercise/icons.tsx`.
   - Move `PlayIcon`, `StopIcon`, `EyeIcon`.
   - Export and import in the component that renders buttons.

4. **Extract utils**
   - New file: `AnswerBrowserExercise/utils/extensionToLanguage.ts` (or `utils.ts`): move `extensionToLanguage`.
   - New file: `AnswerBrowserExercise/utils/formatLogsForDisplay.ts` (or same `utils.ts`): move `formatLogsForDisplay`.
   - Import in the main component and in any subcomponent that needs them.

5. **Extract types**
   - New file: `AnswerBrowserExercise/types.ts`.
   - Move `Props` and any shared types (e.g. for output panel mode).
   - Main component and subcomponents import from `./types`.

After Phase A, the main file should contain only: imports, hooks usage, a few derived vars, and JSX. No styled definitions, no icons, no pure utils. **Run the app and tests to confirm behavior is unchanged.**

---

### Phase B: Split UI into subcomponents

6. **Extract `EditorSection`**
   - New file: `AnswerBrowserExercise/components/EditorSection.tsx`.
   - Props: `filepath`, `contents`, `editorKey`, `onChange`, `editorFiles`, `setEditorState` (or a single `onContentChange(newContent)` and parent keeps editor state).
   - Renders: EditorSection wrapper, EditorWrapper, Monaco Editor.
   - Uses: `extensionToLanguage` from utils.
   - Styles: import from `../styles`.

7. **Extract `ActionButtons`**
   - New file: `AnswerBrowserExercise/components/ActionButtons.tsx`.
   - Props: `isPython`, `runOrTestDisabled`, `testInProgress`, `showRun`, `contents`, `onRun`, `onTest`, `onResetClick`, `stubDownloadUrl`, `filepath` (for test).
   - Renders: ButtonRow, Run/Stop, Test, Reset.
   - Uses: icons from `../icons`, styles from `../styles`, `t` from `useTranslation`.

8. **Extract `ResetConfirmDialog`**
   - New file: `AnswerBrowserExercise/components/ResetConfirmDialog.tsx`.
   - Props: `open`, `onCancel`, `onConfirm`.
   - Renders: ConfirmOverlay, ConfirmDialog, message, Cancel/OK.
   - Uses: styles from `../styles`, `t("are-you-sure")`, `t("button.cancel")`, `t("button.ok")`.

9. **Extract `TestResultCard`**
   - New file: `AnswerBrowserExercise/components/TestResultCard.tsx`.
   - Props: `name`, `passed`, `message`, `exception` (array).
   - Renders: TestResultCard, TestResultHeader, TestResultMessage.
   - Uses: styles from `../styles`.

10. **Extract `TestResultsContent`**
    - New file: `AnswerBrowserExercise/components/TestResultsContent.tsx`.
    - Props: `testResults: RunResult`.
    - Renders: either list of `TestResultCard` or status + logs (using `formatLogsForDisplay`).
    - Uses: `TestResultCard`, styles, `formatLogsForDisplay`.

11. **Extract `RunOutputContent`**
    - New file: `AnswerBrowserExercise/components/RunOutputContent.tsx`.
    - Props: `pyodideLoading`, `runExecuting`, `runOutput`, `runError`.
    - Renders: OutputPre with loading/running/output/error.
    - Uses: styles.

12. **Extract `OutputPanel`**
    - New file: `AnswerBrowserExercise/components/OutputPanel.tsx`.
    - Props: `mode: 'run' | 'test-running' | 'test-results'`, run output props, test results (optional).
    - Renders: OutputContainer, OutputHeader (title by mode), OutputBody.
    - Body: if `test-running` → “Running tests...”; if `test-results` → `<TestResultsContent />`; else → `<RunOutputContent />`.
    - Uses: RunOutputContent, TestResultsContent, styles.

After Phase B, the main component only: uses hooks, computes `mode` and what to pass, and renders `<Card><EditorSection ... /><ActionButtons ... /><ResetConfirmDialog ... /><OutputPanel ... /></Card>`. **Verify behavior again.**

---

### Phase C: Extract hooks (optional but recommended)

13. **Extract `useEditorState`**
    - New file: `AnswerBrowserExercise/hooks/useEditorState.ts`.
    - Input: `initialState`, `publicSpec.stub_download_url`, `setState` (parent updater).
    - Returns: `editorFiles`, `setEditorState`, `handleReset` (restore from original + bump key), `editorKey`, `originalStateRef` (if needed elsewhere).
    - Encapsulates: `originalStateRef`, sync effect on `stub_download_url`, `setEditorState` that updates parent.

14. **Extract `useRunOutput`**
    - New file: `AnswerBrowserExercise/hooks/useRunOutput.ts`.
    - Returns: `runOutput`, `runError`, `pyodideLoading`, `runExecuting`, `handleRunPython(contents)`.
    - Encapsulates: Pyodide load, stdout/stderr capture, `runPythonAsync`, and all related state.

15. **Extract `useTestRun`**
    - New file: `AnswerBrowserExercise/hooks/useTestRun.ts`.
    - Returns: `testResults`, `testInProgress`, `runTests(stubUrl, filepath, contents)`.
    - Encapsulates: `runBrowserTests`, `waitForTestResults`, and state updates.

Main component then looks like:

```tsx
const editor = useEditorState(initialState, publicSpec.stub_download_url, setState)
const run = useRunOutput()
const test = useTestRun()
const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
// … minimal derived state (isPython, showRun, outputPanelMode)
return (
  <Card>
    <EditorSection ... editor={editor} />
    <ActionButtons ... onRun={run.handleRunPython} onTest={test.runTests} onResetClick={() => setResetConfirmOpen(true)} />
    <ResetConfirmDialog open={resetConfirmOpen} onConfirm={editor.handleReset} onCancel={...} />
    <OutputPanel mode={...} run={run} testResults={test.testResults} />
  </Card>
)
```

This keeps the main file short and makes it easy to add e.g. Submit or another panel by adding a hook and a subcomponent.

---

## 4. File layout summary

```
AnswerBrowserExercise/
  index.tsx                      # export default AnswerBrowserExercise
  AnswerBrowserExercise.tsx      # main component (~80–120 lines)
  types.ts                       # Props, OutputPanelMode, etc.
  styles.ts                      # all styled components
  icons.tsx                      # PlayIcon, StopIcon, EyeIcon
  utils/
    extensionToLanguage.ts
    formatLogsForDisplay.ts
  hooks/
    useEditorState.ts
    useRunOutput.ts
    useTestRun.ts
  components/
    EditorSection.tsx
    ActionButtons.tsx
    ResetConfirmDialog.tsx
    OutputPanel.tsx
    RunOutputContent.tsx
    TestResultsContent.tsx
    TestResultCard.tsx
```

Update the parent import from:

```ts
import AnswerBrowserExercise from "./AnswerBrowserExercise"
```

to:

```ts
import AnswerBrowserExercise from "./AnswerBrowserExercise"  # or "./AnswerBrowserExercise/index"
```

so it still resolves to the new `index.tsx`.

---

## 5. Practices to follow

- **One concern per file**  
  Styles, icons, utils, hooks, and presentational components each in their own file.

- **Props over context for this screen**  
  Pass callbacks and data explicitly into `EditorSection`, `ActionButtons`, `OutputPanel`, etc. Avoid a big “exercise context” unless you add many more consumers.

- **Keep subcomponents presentational where possible**  
  `OutputPanel`, `TestResultCard`, `RunOutputContent` take data and callbacks; they don’t fetch or know about Pyodide/test API.

- **Naming**  
  Components: PascalCase. Hooks: `use*`. Utils: camelCase. Styles: same names as now so diffs stay small.

- **Barrel exports (optional)**  
  `components/index.ts` can re-export EditorSection, ActionButtons, … so the main file can do `import { EditorSection, ActionButtons } from './components'` if you prefer.

- **Tests**  
  After refactor, add a simple test that renders `AnswerBrowserExercise` with minimal props and, if possible, that `handleRunPython` / `runTests` are called when buttons are clicked (mock the request helpers).

---

## 6. Suggested order of implementation

1. Phase A (steps 1–5): extract styles, icons, utils, types; keep one main component file.
2. Phase B (steps 6–12): extract subcomponents; main file composes them.
3. Phase C (steps 13–15): extract hooks; main file becomes thin.
4. Add or adjust tests and fix any lint/type issues.

Doing Phase A first gives the biggest readability win with the least risk; then Phase B makes the main JSX obvious; Phase C makes adding new behavior (e.g. submit, more panels) straightforward.
