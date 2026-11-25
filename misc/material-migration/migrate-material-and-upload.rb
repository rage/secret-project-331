#!/usr/bin/env ruby

require 'json'
require 'openssl'
require 'securerandom'
require 'rest-client'

base_url = ENV.fetch('BASE_URL').sub(%r{/$}, '')
output_dir = ENV.fetch('MIGRATION_OUTPUT_DIR').sub(%r{/$}, '')
course_id = ENV.fetch('COURSE_ID')
session_cookie = ENV.fetch('UPLOAD_AUTH_COOKIE')
# Continues an interrupted import: reuses chapters whose front page exists and skips pages whose
# url_path already exists, so only what failed last time is uploaded.
resume = ENV['MIGRATION_RESUME'] == '1'

headers = {
  cookie: "session=#{session_cookie}",
  accept: :json,
  content_type: :json,
}

def request_json(method:, url:, headers:, payload: nil)
  args = {
    method: method,
    url: url,
    headers: headers,
    verify_ssl: OpenSSL::SSL::VERIFY_NONE
  }
  args[:payload] = JSON.generate(payload) unless payload.nil?
  response = RestClient::Request.execute(**args)
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

def block_contains_name?(blocks, name)
  blocks.any? do |block|
    block['name'] == name || block['innerBlocks'].is_a?(Array) && block_contains_name?(block['innerBlocks'], name)
  end
end

# "osa-2/..." before "osa-10/..." and "2-x" before "10-x".
def natural_sort_key(path)
  path.split(/(\d+)/).map { |part| part.match?(/\A\d+\z/) ? part.to_i : part }
end

json_files = Dir.glob(File.join(output_dir, 'pages', '**', '*.json')).sort_by { |file| natural_sort_key(file) }
page_entries = []
chapter_entries = {}
information_page_entries = []
home_page_entry = nil

json_files.each do |json_file|
  page_data = JSON.parse(File.read(json_file))
  chapter_slug = page_data['chapter_slug']
  chapter_number = page_data['chapter_number']
  is_front_page = page_data['is_front_page']
  entry = {
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

existing_pages_by_path = {}
if resume
  request_json(method: :get, url: "#{base_url}/api/v0/cms/courses/#{course_id}/pages", headers: headers).each do |page|
    existing_pages_by_path[page['url_path']] = page
  end
  puts "Resuming: #{existing_pages_by_path.size} existing page(s) are kept and skipped"
end

chapter_entries.values.sort_by { |chapter| [chapter[:chapter_number] || 0, chapter[:chapter_slug]] }.each do |chapter|
  existing_front_page = existing_pages_by_path["/#{chapter[:chapter_slug]}"]
  if existing_front_page && existing_front_page['chapter_id']
    puts "Reusing chapter #{chapter[:chapter_slug]}"
    created_chapter_ids[chapter[:chapter_slug]] = existing_front_page['chapter_id']
    created_chapter_front_page_ids[chapter[:chapter_slug]] = existing_front_page['id']
    next
  end

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
  [entry[:data]['is_front_page'] ? 0 : 1, natural_sort_key(entry[:json_file])]
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
    elsif existing_pages_by_path.key?(data['url_path'])
      puts "Skipping existing page #{data['url_path']}"
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

information_page_entries.each do |entry|
  data = entry[:data]
  if existing_pages_by_path.key?(data['url_path'])
    puts "Skipping existing information page #{data['url_path']}"
    next
  end

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
  all_pages = request_json(
    method: :get,
    url: "#{base_url}/api/v0/cms/courses/#{course_id}/pages",
    headers: headers,
  )

  course_front_page = all_pages.find { |page| page['url_path'] == '/' }

  if course_front_page
    # These blocks are LMS-specific and should be preserved from the existing frontpage.
    # They render the chapter grid, information pages, completion congratulations and progress.
    lms_skeleton_block_names = %w[
      moocfi/course-chapter-grid
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
    # The platform won't publish a course front page without its title section.
    hero_blocks = existing_content.select { |block| block['name'] == 'moocfi/landing-page-hero-section' }

    # The moocfi/hero-section block from frontmatter is a chapter-level block and
    # doesn't belong on the course frontpage — filter it out from the migrated content.
    migrated_blocks = data['content'].reject { |block| block['name'] == 'moocfi/hero-section' }

    new_content = hero_blocks + migrated_blocks + preserved_blocks

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

    The course is now PARTIALLY migrated. Don't fix the result by hand. Instead:
      1. Fix the cause of each failure listed above.
      2. Re-run with MIGRATION_RESUME=1 into the same course: existing chapters are reused and
         existing pages skipped (chapter and course front pages are overwritten again).
  MSG
  # Non-zero exit so the wrapper script / CI surfaces partial failures, while still having
  # imported everything that did succeed (including the chapter front pages).
  exit 1
end
