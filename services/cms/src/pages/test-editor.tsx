import dynamicImport from "@/shared-module/common/utils/dynamicImport"

const TestEditor = dynamicImport(() => import("@/components/editors/TestEditor"))

const TestEditorPage = () => {
  return (
    <div>
      <TestEditor />
    </div>
  )
}

export default TestEditorPage
