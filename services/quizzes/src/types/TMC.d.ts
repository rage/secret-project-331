export interface TMCProfile {
  username: string
  accessToken: string
}

export interface TMCProfileDetails {
  id: number
  username: string
  email: string
  administrator: boolean
  error?: string
  user_field?: {
    first_name: string
    last_name: string
    organizational_id: string
    course_announcements: boolean
  }
  extra_fields?: {
    language: string
    open_university: string
    helsinki_university: string
    research: string
    marketing: string
    deadline: string
  }
}

export interface TMCCredentials {
  username: string
  password: string
}
