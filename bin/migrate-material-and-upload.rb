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
end

def block_contains_name?(blocks, name)
  blocks.any? do |block|
    block['name'] == name || block['innerBlocks'].is_a?(Array) && block_contains_name?(block['innerBlocks'], name)
  end
end

def chapter_slug_for_markdown_file(markdown_file)
  markdown_file.match(%r{(?:^|/)(chapter-\d+)(?:/|$)})&.captures&.first
end

def chapter_number_for_slug(chapter_slug)
  chapter_slug&.match(/^chapter-(\d+)$/)&.captures&.first&.to_i
end

def page_slug_for_markdown_file(markdown_file)
  File.basename(markdown_file, File.extname(markdown_file))
end

def front_page_for_markdown_file?(markdown_file)
  chapter_slug = chapter_slug_for_markdown_file(markdown_file)
  return false if chapter_slug.nil?

  page_slug = page_slug_for_markdown_file(markdown_file)
  page_slug == chapter_slug || page_slug == 'index'
end

markdown_files = Dir.glob(File.join(material_dir, '**', '*.md')).sort
page_entries = []
chapter_entries = {}
information_page_entries = []

markdown_files.each do |markdown_file|
  json_file = markdown_file.sub(/\.md\z/, '.json')
  next unless File.exist?(json_file)

  page_data = JSON.parse(File.read(json_file))
  chapter_slug = chapter_slug_for_markdown_file(markdown_file)
  chapter_number = chapter_number_for_slug(chapter_slug)
  is_front_page = front_page_for_markdown_file?(markdown_file)
  entry = {
    markdown_file: markdown_file,
    json_file: json_file,
    data: page_data,
  }

  if chapter_slug.nil? || chapter_slug.empty?
    information_page_entries << entry
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

chapter_entries.values.sort_by { |chapter| [chapter[:chapter_number] || 0, chapter[:chapter_slug]] }.each do |chapter|
  payload = {
    name: chapter[:chapter_title] || chapter[:chapter_slug].tr('-', ' ').split.map(&:capitalize).join(' '),
    course_id: course_id,
    chapter_number: chapter[:chapter_number] || 0,
    front_page_id: nil,
  }

  puts "Creating chapter #{chapter[:chapter_slug]} (#{chapter[:chapter_title]})"
  chapter_response = request_json(
    method: :post,
    url: "#{base_url}/api/v0/main-frontend/chapters",
    payload: payload,
    headers: headers,
  )
  created_chapter_ids[chapter[:chapter_slug]] = chapter_response.fetch('id')
  created_chapter_front_page_ids[chapter[:chapter_slug]] = chapter_response.fetch('front_page_id')
end

page_entries.sort_by { |entry| entry[:markdown_file] }.each do |entry|
  data = entry[:data]
  chapter_slug = chapter_slug_for_markdown_file(entry[:markdown_file])
  chapter_id = created_chapter_ids.fetch(chapter_slug)
  front_page_id = created_chapter_front_page_ids.fetch(chapter_slug)
  is_front_page = front_page_for_markdown_file?(entry[:markdown_file])

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
    page_response = request_json(
      method: :put,
      url: "#{base_url}/api/v0/cms/pages/#{front_page_id}",
      payload: update_payload,
      headers: headers,
    )
  else
    page_payload[:url_path] = data['url_path']

    puts "Uploading #{entry[:json_file]} -> chapter #{chapter_slug}"
    page_response = request_json(
      method: :post,
      url: "#{base_url}/api/v0/cms/migration/new_page/#{course_id}",
      payload: page_payload,
      headers: headers,
    )
  end

  puts page_response.inspect
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
  page_response = request_json(
    method: :post,
    url: "#{base_url}/api/v0/cms/migration/new_page/#{course_id}",
    payload: page_payload,
    headers: headers,
  )
  puts page_response.inspect
end
