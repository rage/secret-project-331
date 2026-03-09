import styled from "@emotion/styled"

const colors = {
  primary: "#0275d8",
  accent: "#ff7518",
  accentHover: "#e66a14",
  danger: "#f44141",
  success: "#4caf50",
  successHover: "#228b22",
  error: "#f44336",
  surface: "#fff",
  text: "#252525",
  textMuted: "#666",
  border: "#e0e0e0",
  muted: "#ebebeb",
  mutedHover: "#d5d5d5",
  stdinBg: "#e8e8e8",
} as const

export const Card = styled.div`
  width: 100%;
  max-width: 100%;
  border-radius: 8px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.08);
  background: ${colors.surface};
  padding: 1rem;
  box-sizing: border-box;
`

export const EditorSection = styled.div`
  margin-left: -1rem;
  margin-right: -1rem;
  width: calc(100% + 2rem);
  margin-bottom: 0.6em;
`

export const EditorWrapper = styled.div<{ height?: string }>`
  width: 100%;
  min-height: 200px;
  max-height: 950px;
  border: none;
  border-bottom: 1px solid ${colors.border};
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  background: ${colors.surface};
  height: ${(p) => p.height ?? "400px"};
`

export const ButtonRow = styled.div`
  padding: 0.6em 0em;
`

const StyledButton = styled.button`
  margin: 0.5em;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`

export const RunButton = styled(StyledButton)`
  background-color: ${colors.primary};
  color: ${colors.surface};
  &:hover:not(:disabled) {
    background-color: ${colors.primary};
    color: ${colors.successHover};
  }
`

export const StopButton = styled(StyledButton)`
  background-color: ${colors.primary};
  color: ${colors.surface};
  &:hover:not(:disabled) {
    background-color: ${colors.primary};
    color: ${colors.danger};
  }
`

export const TestButton = styled(StyledButton)`
  background-color: ${colors.accent};
  color: ${colors.surface};
  margin-left: 10px;
  &:hover:not(:disabled) {
    background-color: ${colors.accentHover};
    color: ${colors.surface};
  }
`

export const ResetButton = styled.button`
  margin: 0.5em;
  margin-left: 10px;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  background-color: ${colors.muted};
  color: ${colors.text};
  &:hover {
    background-color: ${colors.mutedHover};
  }
`

export const ConfirmOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
`

export const ConfirmDialog = styled.div`
  background: ${colors.surface};
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  min-width: 280px;
`

export const ConfirmMessage = styled.p`
  margin: 0 0 1rem 0;
  font-size: 1rem;
`

export const ConfirmButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
`

export const TestButtonLabel = styled.span`
  padding-left: 5px;
`

export const TestUnavailableHint = styled.small`
  display: block;
  margin-top: 4px;
  color: ${colors.textMuted};
`

export const OutputContainer = styled.div`
  width: 100%;
  min-height: 100px;
  box-shadow:
    -2px 3px 2px 1px rgba(0, 0, 0, 0.2),
    0px 1px 1px 0px rgba(0, 0, 0, 0.14),
    0px 1px 3px 0px rgba(0, 0, 0, 0.12);
  border: 4px 4px 0 0;
  position: relative;
`

export const OutputHeader = styled.div<{ color: "orange" | "gray" }>`
  background-color: ${(p) => (p.color === "orange" ? "rgb(255, 128, 0)" : colors.stdinBg)};
  color: black;
  border-radius: 3px 3px 0 0;
  padding: 5px;
`

export const OutputHeaderText = styled.span`
  display: inline-block;
  padding: 5px;
  margin-left: 10px;
  color: ${colors.text};
  font-weight: 700;
`

export const OutputBody = styled.div`
  padding: 10px;
  min-height: 6rem;
  background: ${colors.surface};
  border-radius: 0 0 3px 3px;
`

export const OutputPre = styled.pre`
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
  font-size: 0.875rem;
  color: ${colors.text};
`

export const StdinWaitingBanner = styled.div`
  background-color: rgb(255, 128, 0);
  color: ${colors.text};
  padding: 8px 10px;
  margin: 0 -10px 10px -10px;
  border-radius: 3px;
  font-weight: 700;
  font-size: 0.875rem;
`

/** Single line: prompt + optional submitted input (grey) on same line */
export const StdinLineRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0;
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
  font-size: 0.875rem;
  color: ${colors.text};
  margin-bottom: 8px;
`

export const StdinPromptLine = styled.span`
  font-family: inherit;
  font-size: inherit;
  color: inherit;
`

/** Submitted stdin (grey background, inline so it ends at end of string) */
export const StdinSubmittedLine = styled.span`
  display: inline;
  font-family: inherit;
  font-size: inherit;
  background-color: ${colors.stdinBg};
  color: ${colors.text};
  padding: 2px 6px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
`

export const StdinHint = styled.div`
  font-size: 0.8125rem;
  color: ${colors.textMuted};
  margin-bottom: 6px;
`

export const StdinInput = styled.input`
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
  font-size: 0.875rem;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%;
  max-width: 400px;
  box-sizing: border-box;
`

export const TestResultCard = styled.div<{ passed: boolean }>`
  border-left: 10px solid ${(p) => (p.passed ? colors.success : colors.error)};
  margin: 5px;
  padding: 10px;
  background: ${colors.surface};
`

export const TestResultHeader = styled.div<{ passed: boolean }>`
  color: ${(p) => (p.passed ? colors.success : colors.error)};
  font-weight: 700;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
`

export const TestResultMessage = styled.pre`
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font-family: ui-monospace, monospace;
  font-size: 0.8125rem;
  color: ${colors.text};
`
