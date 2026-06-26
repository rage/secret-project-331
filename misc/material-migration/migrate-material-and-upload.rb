#!/usr/bin/env ruby

require 'json'
require 'openssl'
require 'securerandom'
require 'rest-client'

base_url = ENV.fetch('BASE_URL').sub(%r{/$}, '')
material_dir = ENV.fetch('MATERIAL_DIR').sub(%r{/$}, '')
course_id = ENV.fetch('COURSE_ID')
session_cookie = ENV.fetch('UPLOAD_AUTH_COOKIE')

headers = {
  cookie: "session=#{session_cookie}",
  accept: :json,
  content_type: :json,
}

def request_json(method:, url:, payload:, headers:)
  response = RestClient::Request.execute(
    method: method,
    url: url,
    payload: JSON.generate(payload),
    headers: headers,
    verify_ssl: OpenSSL::SSL::VERIFY_NONE
  )
  JSON.parse(response.body)
rescue RestClient::ExceptionWithResponse => e
  # e.response can be nil when the connection drops mid-request (common when the server is
  # overloaded); guard against it so the real failure isn't masked by a NoMethodError on nil.
  if e.response
    raise "HTTP #{e.response.code} from #{method.upcase} #{url}: #{e.response.body}"
  else
    raise "No response from #{method.upcase} #{url} (connection dropped?): #{e.message}"
  end
rescue RestClient::Exceptions::OpenTimeout, RestClient::Exceptions::ReadTimeout => e
  raise "Timeout during #{method.upcase} #{url}: #{e.message}"
rescue SocketError, Errno::ECONNREFUSED, Errno::ECONNRESET => e
  raise "Network error during #{method.upcase} #{url}: #{e.message}"
rescue JSON::ParserError => e
  raise "JSON parse error from #{method.upcase} #{url}: #{e.message}"
end

def get_json(url:, headers:)
  response = RestClient::Request.execute(
    method: :get,
    url: url,
    headers: headers,
    verify_ssl: OpenSSL::SSL::VERIFY_NONE
  )
  JSON.parse(response.body)
rescue RestClient::ExceptionWithResponse => e
  if e.response
    raise "HTTP #{e.response.code} from GET #{url}: #{e.response.body}"
  else
    raise "No response from GET #{url} (connection dropped?): #{e.message}"
  end
rescue RestClient::Exceptions::OpenTimeout, RestClient::Exceptions::ReadTimeout => e
  raise "Timeout during GET #{url}: #{e.message}"
rescue SocketError, Errno::ECONNREFUSED, Errno::ECONNRESET => e
  raise "Network error during GET #{url}: #{e.message}"
rescue JSON::ParserError => e
  raise "JSON parse error from GET #{url}: #{e.message}"
end

def block_contains_name?(blocks, name)
  blocks.any? do |block|
    block['name'] == name || block['innerBlocks'].is_a?(Array) && block_contains_name?(block['innerBlocks'], name)
  end
end

markdown_files = Dir.glob(File.join(material_dir, '**', '*.md')).sort
page_entries = []
chapter_entries = {}
information_page_entries = []
home_page_entry = nil

markdown_files.each do |markdown_file|
  json_file = markdown_file.sub(/\.md\z/, '.json')
  next unless File.exist?(json_file)

  page_data = JSON.parse(File.read(json_file))
  chapter_slug = page_data['chapter_slug']
  chapter_number = page_data['chapter_number']
  is_front_page = page_data['is_front_page']
  entry = {
    markdown_file: markdown_file,
    json_file: json_file,
    data: page_data,
  }

  if chapter_slug.nil? || chapter_slug.empty?
    if page_data['home_page'] == true
      home_page_entry = entry
    else
      information_page_entries << entry
    end
  else
    page_entries << entry

    chapter_entries[chapter_slug] ||= {
      chapter_slug: chapter_slug,
      chapter_number: chapter_number,
      chapter_title: nil,
    }

    if is_front_page
      chapter_entries[chapter_slug][:chapter_title] ||= page_data['title']
    end
  end
end

created_chapter_ids = {}
created_chapter_front_page_ids = {}
# Collect per-item failures instead of letting the first error abort the whole import.
failures = []

chapter_entries.values.sort_by { |chapter| [chapter[:chapter_number] || 0, chapter[:chapter_slug]] }.each do |chapter|
  payload = {
    name: chapter[:chapter_title] || chapter[:chapter_slug].tr('-', ' ').split.map(&:capitalize).join(' '),
    course_id: course_id,
    chapter_number: chapter[:chapter_number] || 0,
    front_page_id: nil,
  }

  puts "Creating chapter #{chapter[:chapter_slug]} (#{chapter[:chapter_title]})"
  begin
    chapter_response = request_json(
      method: :post,
      url: "#{base_url}/api/v0/main-frontend/chapters",
      payload: payload,
      headers: headers,
    )
    created_chapter_ids[chapter[:chapter_slug]] = chapter_response.fetch('id')
    created_chapter_front_page_ids[chapter[:chapter_slug]] = chapter_response.fetch('front_page_id')
  rescue StandardError => e
    warn "ERROR creating chapter #{chapter[:chapter_slug]}: #{e.message}"
    failures << "chapter #{chapter[:chapter_slug]}: #{e.message}"
  end
end

# Import chapter front pages before content pages so each chapter's landing page and its
# url_path (e.g. /part-1) exist regardless of whether individual content pages fail below.
sorted_page_entries = page_entries.sort_by do |entry|
  [entry[:data]['is_front_page'] ? 0 : 1, entry[:markdown_file]]
end

sorted_page_entries.each do |entry|
  data = entry[:data]
  chapter_slug = data['chapter_slug']

  begin
    chapter_id = created_chapter_ids.fetch(chapter_slug)
    front_page_id = created_chapter_front_page_ids.fetch(chapter_slug)
    is_front_page = data['is_front_page']

    page_payload = {
      content: data['content'].dup,
      exercises: data['exercises'],
      exercise_slides: data['exercise_slides'],
      exercise_tasks: data['exercise_tasks'],
      title: data['title'],
      chapter_id: chapter_id,
      hidden: data['hidden'] || false,
    }

    if is_front_page
      page_payload[:url_path] = "/#{chapter_slug}"
      content = page_payload[:content].dup

      unless block_contains_name?(content, 'moocfi/pages-in-chapter')
        content << {
          'clientId' => SecureRandom.uuid,
          'isValid' => true,
          'name' => 'moocfi/pages-in-chapter',
          'attributes' => {},
          'innerBlocks' => [],
        }
      end

      update_payload = {
        content: content,
        exercises: page_payload[:exercises],
        exercise_slides: page_payload[:exercise_slides],
        exercise_tasks: page_payload[:exercise_tasks],
        url_path: page_payload[:url_path],
        title: page_payload[:title],
        chapter_id: chapter_id,
        hidden: data['hidden'] || false,
      }

      puts "Updating front page #{entry[:json_file]} -> chapter #{chapter_slug}"
      request_json(
        method: :put,
        url: "#{base_url}/api/v0/cms/pages/#{front_page_id}",
        payload: update_payload,
        headers: headers,
      )
    else
      page_payload[:url_path] = data['url_path']

      puts "Uploading #{entry[:json_file]} -> chapter #{chapter_slug}"
      request_json(
        method: :post,
        url: "#{base_url}/api/v0/cms/migration/new_page/#{course_id}",
        payload: page_payload,
        headers: headers,
      )
    end
  rescue StandardError => e
    warn "ERROR importing #{entry[:json_file]} (chapter #{chapter_slug}): #{e.message}"
    failures << "#{entry[:json_file]}: #{e.message}"
  end
end

information_page_entries.sort_by { |entry| entry[:markdown_file] }.each do |entry|
  data = entry[:data]

  page_payload = {
    content: data['content'].dup,
    exercises: data['exercises'],
    exercise_slides: data['exercise_slides'],
    exercise_tasks: data['exercise_tasks'],
    title: data['title'],
    url_path: data['url_path'],
    chapter_id: nil,
    hidden: data['hidden'] || false,
  }

  puts "Uploading information page #{entry[:json_file]}"
  begin
    request_json(
      method: :post,
      url: "#{base_url}/api/v0/cms/migration/new_page/#{course_id}",
      payload: page_payload,
      headers: headers,
    )
  rescue StandardError => e
    warn "ERROR importing information page #{entry[:json_file]}: #{e.message}"
    failures << "#{entry[:json_file]}: #{e.message}"
  end
end

if home_page_entry
  begin
  data = home_page_entry[:data]

  puts "Fetching course pages to find the course front page"
  all_pages = get_json(
    url: "#{base_url}/api/v0/cms/courses/#{course_id}/pages",
    headers: headers,
  )

  course_front_page = all_pages.find { |page| page['url_path'] == '/' }

  if course_front_page
    # These blocks are LMS-specific and should be preserved from the existing frontpage.
    # They handle course progress display, information pages, and completion congratulations.
    lms_skeleton_block_names = %w[
      moocfi/top-level-pages
      moocfi/congratulations
      moocfi/course-progress
    ]

    existing_content = course_front_page['content']
    existing_content = JSON.parse(existing_content) if existing_content.is_a?(String)
    existing_content = Array(existing_content)

    preserved_blocks = existing_content.select do |block|
      lms_skeleton_block_names.include?(block['name'])
    end

    # The moocfi/hero-section block from frontmatter is a chapter-level block and
    # doesn't belong on the course frontpage — filter it out from the migrated content.
    migrated_blocks = data['content'].reject { |block| block['name'] == 'moocfi/hero-section' }

    new_content = migrated_blocks + preserved_blocks

    update_payload = {
      content: new_content,
      exercises: data['exercises'],
      exercise_slides: data['exercise_slides'],
      exercise_tasks: data['exercise_tasks'],
      url_path: '/',
      title: data['title'],
      chapter_id: nil,
      hidden: data['hidden'] || false,
    }

    puts "Updating course front page (id=#{course_front_page['id']}) from #{home_page_entry[:json_file]}"
    request_json(
      method: :put,
      url: "#{base_url}/api/v0/cms/pages/#{course_front_page['id']}",
      payload: update_payload,
      headers: headers,
    )
    puts "Course front page updated successfully"
  else
    puts "WARNING: Could not find course front page with url_path '/'. Uploading as information page instead."
    page_payload = {
      content: data['content'].dup,
      exercises: data['exercises'],
      exercise_slides: data['exercise_slides'],
      exercise_tasks: data['exercise_tasks'],
      title: data['title'],
      url_path: data['url_path'],
      chapter_id: nil,
      hidden: data['hidden'] || false,
    }
    request_json(
      method: :post,
      url: "#{base_url}/api/v0/cms/migration/new_page/#{course_id}",
      payload: page_payload,
      headers: headers,
    )
  end
  rescue StandardError => e
    warn "ERROR importing home page #{home_page_entry[:json_file]}: #{e.message}"
    failures << "#{home_page_entry[:json_file]}: #{e.message}"
  end
end

if failures.empty?
  puts "\nImport finished: all chapters and pages imported successfully."
else
  warn "\nImport finished with #{failures.size} failed page/chapter upload(s):"
  failures.each { |failure| warn "  - #{failure}" }
  warn <<~MSG

    The course is now PARTIALLY migrated. There is no way to migrate individual pages
    afterwards, so do not fix the result by hand. Instead:
      1. Fix the cause of each failure listed above.
      2. Delete the partially migrated course (or create a fresh one).
      3. Re-run this script against the clean course.
  MSG
  # Non-zero exit so the wrapper script / CI surfaces partial failures, while still having
  # imported everything that did succeed (including the chapter front pages).
  exit 1
end
