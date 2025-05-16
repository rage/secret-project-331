import { loader } from "@monaco-editor/react"

loader.config({
  paths: {
    // See https://github.com/microsoft/monaco-editor/issues/4778
    vs: window.location.origin + "/monaco-editor/min/vs",
  },
})
