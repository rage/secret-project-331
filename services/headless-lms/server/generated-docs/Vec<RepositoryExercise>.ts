type Vec<RepositoryExercise> = Array<{
  id: string
  repository_id: string
  part: string
  name: string
  repository_url: string
  checksum: Array<number>
  download_url: string
}>
