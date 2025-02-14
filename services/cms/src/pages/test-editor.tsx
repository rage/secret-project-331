import dynamic from "next/dynamic"

import Spinner from "@/shared-module/common/components/Spinner"

const EditorLoading = <Spinner variant="medium" />

const TestEditor = dynamic(() => import("@/components/editors/TestEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const TestEditorPage = () => {
  return (
    <div>
      <TestEditor />
    </div>
  )
}

export default TestEditorPage
