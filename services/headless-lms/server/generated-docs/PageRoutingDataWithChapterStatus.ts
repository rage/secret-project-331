type PageRoutingDataWithChapterStatus = {
  url_path: string
  title: string
  chapter_number: number
  chapter_id: string
  chapter_opens_at: Date | null
  chapter_front_page_id: string | null
  chapter_status: ChapterStatus
}
