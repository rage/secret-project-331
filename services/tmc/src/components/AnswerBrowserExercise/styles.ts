import styled from "@emotion/styled"

export const Card = styled.div`
  width: 100%;
  max-width: 100%;
  border-radius: 8px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.08);
  background: #fff;
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
  border-bottom: 1px solid #e0e0e0;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  background: #fff;
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
  background-color: #0275d8;
  color: #fff;
  &:hover:not(:disabled) {
    background-color: #0275d8;
    color: #228b22;
  }
`

export const StopButton = styled(StyledButton)`
  background-color: #0275d8;
  color: #fff;
  &:hover:not(:disabled) {
    background-color: #0275d8;
    color: #f44141;
  }
`

export const TestButton = styled(StyledButton)`
  background-color: #ff7518;
  color: #fff;
  margin-left: 10px;
  &:hover:not(:disabled) {
    background-color: #e66a14;
    color: #fff;
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
  background-color: #ebebeb;
  color: #252525;
  &:hover {
    background-color: #d5d5d5;
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
  background: #fff;
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
  color: #666;
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
  background-color: ${(p) => (p.color === "orange" ? "rgb(255, 128, 0)" : "#e8e8e8")};
  color: black;
  border-radius: 3px 3px 0 0;
  padding: 5px;
`

export const OutputHeaderText = styled.span`
  display: inline-block;
  padding: 5px;
  margin-left: 10px;
  color: #252525;
  font-weight: 700;
`

export const OutputBody = styled.div`
  padding: 10px;
  min-height: 6rem;
  background: #fff;
  border-radius: 0 0 3px 3px;
`

export const OutputPre = styled.pre`
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
  font-size: 0.875rem;
  color: #252525;
`

export const StdinWaitingBanner = styled.div`
  background-color: rgb(255, 128, 0);
  color: #252525;
  padding: 8px 10px;
  margin: 0 -10px 10px -10px;
  border-radius: 3px;
  font-weight: 700;
  font-size: 0.875rem;
`

export const StdinPromptLine = styled.div`
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
  font-size: 0.875rem;
  color: #252525;
  margin-bottom: 4px;
`

export const StdinHint = styled.div`
  font-size: 0.8125rem;
  color: #666;
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
  border-left: 10px solid ${(p) => (p.passed ? "#4caf50" : "#f44336")};
  margin: 5px;
  padding: 10px;
  background: #fff;
`

export const TestResultHeader = styled.div<{ passed: boolean }>`
  color: ${(p) => (p.passed ? "#4caf50" : "#f44336")};
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
  color: #252525;
`
