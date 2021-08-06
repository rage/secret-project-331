const PointExportButton: React.FC<{ courseInstanceId: string }> = ({ courseInstanceId }) => {
  return (
    <a
      href={`/api/v0/main-frontend/course-instances/${courseInstanceId}/point_export`}
      download={`points-${courseInstanceId}.csv`}
    >
      Export points as CSV
    </a>
  )
}

export default PointExportButton
