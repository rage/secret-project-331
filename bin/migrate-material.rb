#!/usr/bin/env ruby

require 'json'
require 'securerandom'
require 'rest-client'
require 'dotenv/load'
require 'pathname'

class MaterialMigrator
  def initialize(directory)
    unless File.directory?(directory)
      raise ArgumentError, "#{directory} is not a directory."
      exit
    end

    @directory = directory.end_with?('/') ? directory : "#{directory}/"
    @files = Dir.glob("#{@directory}**/*")
    # @uuid = SecureRandom.uuid
    # @inside_a_block = false
    @inside_frontmatter = false
    @current_tag_type = ''
    @tag_depth = 0
    @known_tags = ['styled-text', 'text-box', 'div', 'quiz', 'img', 'iframe', 'span']
    @uploaded_extra_files = {}

    puts "found #{@files.count} files and directories"

    # extra_files = Dir.glob("#{@directory}**/*.{png,jpg,jpeg,svg,pdf}")
    # @extra_files_urls = upload_extra_files
    process_files
  end

  private

  def process_files
    i = 0
    @files.each do |file|
      i += 1
      # @inside_a_block = false
      @inside_frontmatter = false
      @current_tag_type = ''
      @tag_depth = 0

      if File.directory?(file)
        puts "skipping directory #{file}"
        next
      end

      # TODO: handle other file types too
      unless file.end_with?('.md', '.png', '.svg', '.jpg', '.jpeg', '.json') # TODO: remove .json, it's just for testing to ignore already created .json files
        puts "skipping file #{file} due to file type"
        next
      end

      if file.end_with?('.md')
        puts "processing file #{file} (#{i}/#{@files.count})"
        process_file(file)
      end
    end
  end

  def process_file(file)
    content = File.read(file)

    json_content = []
    @normalized_exercises = []
    @normalized_exercise_slides = []
    @normalized_exercise_tasks = []
    @exercise_count = 0
    @hidden = false

    json_block = create_new_block

    content.split("\n").each do |line|
      # puts 'line: ' + line
      # puts 'tag depth: ' + @tag_depth.to_s
      # puts 'json block: ' + json_block.to_json
      # puts 'json content: ' + json_content.to_json
      line = line.strip
      # if line.empty? && @inside_a_block
      if line.empty? && @tag_depth > 0
        # if @current_tag_type == 'styled-text'
        #   json_block[:attributes][:content] << "\n"
        # elsif @current_tag_type == 'quiz'
        append_to_last_block_content(json_block, "\n")
        # if @current_tag_type == 'quiz'
        #   json_block[:innerBlocks].last[:innerBlocks].last[:innerBlocks].last[:innerBlocks].last[:attributes][:content] << "\n"
        # else
        #   json_block[:innerBlocks].last[:attributes][:content] << "\n"
        # end
        next
      end

      if line == '---'
        if !@inside_frontmatter
          json_block[:name] = 'moocfi/hero-section'
        end
        if @inside_frontmatter
          json_content << json_block
          json_block = create_new_block
        end
        @inside_frontmatter = !@inside_frontmatter
        next
      end

      if @inside_frontmatter
        # TODO: do we want anything else from the frontmatter besides the title?
        process_frontmatter_line(line, json_block)
        next
      end

      if line.start_with?('<br')
        handle_br(json_block, json_content)
        next
      end

      if line.start_with?('<') && line.end_with?('>')
        if line.end_with?('/>')
          # TODO: do something about oneliner tags, in format <tag />
            puts "skipping oneliner tag on line #{line}"
            next
        end

        if line.start_with?('<!--')
          # TODO: do we want to save comments?
          puts "skipping comment on line #{line}"
          next
        end

        if line.start_with?('</')
          # @inside_a_block = false
          if @known_tags.include?(@current_tag_type)
            @tag_depth = @tag_depth - 1
            if @tag_depth == 0 && @current_tag_type != 'styled-text'
              json_content << json_block
              json_block = create_new_block
            elsif @tag_depth == 0 && @current_tag_type == 'styled-text'
              json_block = create_new_block
            end
          end
          next
        end

        # @inside_a_block = true
        @tag_depth = @tag_depth + 1
        tag_type = line.match(/<([a-zA-Z0-9_-]+)(>| [^>]*>)/)[1]
        @current_tag_type = tag_type

        accepted_oneliners = ['styled-text', 'text-box', 'div', 'quiz', 'img', 'iframe', 'span', 'quiz']
        if line.start_with?("<#{tag_type}") && line.end_with?("</#{tag_type}>") && !accepted_oneliners.include?(tag_type)
          # TODO: handle onliner tags with content, in format <tag>content</tag>
          puts "skipping oneliner tag #{tag_type} on line #{line}"
          @tag_depth = @tag_depth - 1
          next
        end

        json_block = handle_block(tag_type, line, json_block, file, json_content) || json_block
        next
      end

      # if @inside_a_block
        if @tag_depth > 0
          if line.start_with?('#')
            json_block = handle_header(line, json_block, json_content)
            next
          end
        # convert markdown link to a html link
        # if /.*\[.+\]\(.+\).*/.match?(line)
        #   line = line.gsub(/\[(.+)\]\((.+)\)/, '<a href="\2">\1</a>')
        # end
        line = convert_markdown_links_to_html(line)
        # if @current_tag_type == 'styled-text'
        #   json_block[:attributes][:content] << line + "\n"
        # elsif @current_tag_type == 'quiz'
        append_to_last_block_content(json_block, line + "\n")
        # if @current_tag_type == 'quiz'
        #   json_block[:innerBlocks].last[:innerBlocks].last[:innerBlocks].last[:innerBlocks].last[:attributes][:content] << line
        # else
        #   json_block[:innerBlocks].last[:attributes][:content] << line + "\n"
        # end
      end

      # unless line.empty? || @inside_a_block
      unless line.empty? || @tag_depth > 0
        json_content << {
          'clientId': SecureRandom.uuid,
          'isValid': true,
          'name': 'core/paragraph',
          'attributes': {
            'content': line,
            'dropCap': false,
          },
          'innerBlocks': [],
        }
      end
    end

    # Safeguard in case a tag wasn't closed properly
    if @tag_depth > 0
      json_content << json_block
    end

    metadata = build_page_metadata(file, json_content)
    wrapped_content = {
      'content': json_content,
      'exercises': @normalized_exercises,
      'exercise_slides': @normalized_exercise_slides,
      'exercise_tasks': @normalized_exercise_tasks,
      'title': metadata[:title],
      'url_path': metadata[:url_path],
      'chapter_id': nil,
      'hidden': @hidden,
    }

    output_file = File.join(File.dirname(file), "#{File.basename(file, File.extname(file))}.json")
    File.open(output_file, 'w') do |f|
      f.write(JSON.pretty_generate(wrapped_content))
    end
  end

  def add_if_present(hash, key, value)
    return if value.nil?
    return if value.respond_to?(:empty?) && value.empty?

    hash[key] = value
  end

  def build_page_metadata(file, json_content)
    relative_path = Pathname.new(file).relative_path_from(Pathname.new(@directory)).to_s
    path_parts = relative_path.split('/')
    page_slug = File.basename(file, File.extname(file))
    language_code = File.basename(@directory.chomp('/'))

    chapter_slug = path_parts.reverse.find { |part| part.match?(/^chapter-\d+$/) }

    chapter_number = if chapter_slug
      chapter_slug.match(/^chapter-(\d+)$/)&.captures&.first&.to_i
    end
    chapter_title = chapter_number ? "Chapter #{chapter_number}" : nil

    title = extract_title_from_blocks(json_content) || page_slug.tr('-', ' ').split.map(&:capitalize).join(' ')
    url_path = if chapter_slug
      "/#{chapter_slug}/#{page_slug}"
    else
      "/#{language_code}/#{page_slug}"
    end
    is_front_page = chapter_slug ? page_slug == chapter_slug || page_slug == 'index' : false

    {
      title: title,
      url_path: url_path,
      chapter_slug: chapter_slug,
      chapter_number: chapter_number,
      chapter_title: chapter_title,
      page_slug: page_slug,
      language_code: language_code,
      source_path: relative_path,
      is_front_page: is_front_page,
    }
  end

  def extract_title_from_blocks(blocks)
    blocks.each do |block|
      title = extract_title_from_block(block)
      return title if title
    end
    nil
  end

  def extract_title_from_block(block)
    if block[:name] == 'moocfi/hero-section'
      attrs = block[:attributes] || {}
      title = attrs[:title] || attrs['title']
      return normalize_title(title) if title
    end

    if block[:name].to_s.start_with?('core/heading')
      attrs = block[:attributes] || {}
      content = attrs[:content] || attrs['content']
      return normalize_title(content) if content
    end

    Array(block[:innerBlocks] || block['innerBlocks']).each do |inner_block|
      title = extract_title_from_block(inner_block)
      return title if title
    end

    nil
  end

  def normalize_title(value)
    value.to_s.strip.gsub(/^['"]+|['"]+$/, '').gsub(/<strong>|<\/strong>/, '').strip
  end

  def create_new_block
    {
      'clientId': SecureRandom.uuid,
      'isValid': true,
      'name': 'core/paragraph', # default to paragraph, will be changed if needed
      'attributes': {},
      'innerBlocks': [],
    }
  end

  def process_frontmatter_line(line, json_block)
    key, value = line.split(':', 2).map(&:strip)

    case key
    when 'title'
      json_block[:attributes][:title] = value
    when 'hidden'
      normalized_value = value.to_s.downcase.delete_prefix('"').delete_suffix('"').delete_prefix("'").delete_suffix("'")
      @hidden = normalized_value == 'true'
    end
  end

  def handle_block(tag_type, line, json_block, file, json_content)
    @current_tag_type = tag_type
    result = case tag_type
    when 'styled-text'
      handle_paragraph(json_block, json_content)
    when 'text-box' # we convert text-boxes to infoboxes
      handle_infobox(line, json_block)
    when 'div'
      handle_div(line, json_block)
    when 'quiz'
      handle_quiz(line, json_block, json_content)
    when 'img'
      handle_image(line, json_block, file, json_content)
    when 'iframe'
      handle_iframe(line, json_block, json_content)
    when 'span'
      handle_span(line, json_block, json_content)
    else
      puts "unknown tag type: #{tag_type}"
      # @inside_a_block = false
      @tag_depth = @tag_depth - 1
    end

    result.is_a?(Hash) ? result : json_block
  end

  def handle_paragraph(json_block, json_content)
    paragraph_block = create_new_block
    paragraph_block[:attributes] = {
      'content': '',
      'dropCap': false,
    }
    json_content << paragraph_block
    paragraph_block
  end

  def handle_infobox(line, json_block)
    json_block[:name] = 'moocfi/infobox'
    attrs = {}
    attrs[:noPadding] = false
    if (m = line.match(/background="([^"]*)"/))
      attrs[:backgroundColor] = m[1]
    end
    json_block[:attributes] = attrs
    if /(?<=name=\").+?(?=")|(?<=name=\').+?(?=')/.match?(line) && line !~ /name=""|name=''/
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/heading',
        'attributes': {
          'content': "<strong>#{line.match(/(?<=name=\").+?(?=")|(?<=name=\').+?(?=')/)}</strong>",
          'level': 2,
        },
        'innerBlocks': [],
      }
    end
    json_block[:innerBlocks] << {
      'clientId': SecureRandom.uuid,
      'isValid': true,
      'name': 'core/paragraph',
      'attributes': {
        'content': '',
        'dropCap': false,
      },
      'innerBlocks': [],
    }
  end

  def handle_div(line, json_block)
    # TODO: account for in-line styles
    json_block[:innerBlocks] << {
      'clientId': SecureRandom.uuid,
      'isValid': true,
      'name': 'core/paragraph',
      'attributes': {
        'content': '',
        'dropCap': false,
      },
      'innerBlocks': [],
    }
  end

  def handle_header(line, json_block, json_content)
    level = line.match(/^#+/)[0].length

    header_block = create_new_block
    header_block[:name] = 'core/heading'
    header_block[:attributes] = {
      'content': line.gsub(/^#+/, '').strip,
      'level': level,
    }

    fresh_block = create_new_block
    fresh_block[:attributes] = {
      'content': '',
      'dropCap': false,
    }

    # Keep markdown headings inside styled-text as top-level blocks so they remain visible.
    if @current_tag_type == 'styled-text'
      json_content << header_block
      json_content << fresh_block
    elsif @tag_depth > 0
      json_block[:innerBlocks] << header_block
      json_block[:innerBlocks] << fresh_block
    else
      json_content << header_block
      json_content << fresh_block
    end
    return fresh_block
    # level = line.match(/^#+/)[0].length
    # json_block[:innerBlocks] << {
    #   'clientId': SecureRandom.uuid,
    #   'isValid': true,
    #   'name': 'core/heading',
    #   'attributes': {
    #     'content': line.gsub(/^#+/, '').strip,
    #     'level': level,
    #   },
    #   'innerBlocks': [],
    # }
    # json_block[:innerBlocks] << {
    #   'clientId': SecureRandom.uuid,
    #   'isValid': true,
    #   'name': 'core/paragraph',
    #   'attributes': {
    #     'content': '',
    #     'dropCap': false,
    #   },
    #   'innerBlocks': [],
    # }
  end

  def handle_quiz(line, json_block, json_content)
    oneliner = line.start_with?('<quiz') && line.end_with?('</quiz>')

    if oneliner
      json_block = create_new_block
    end

    # if oneliner
    #   quiz_block = create_new_block
    #   quiz_id = line.match(/id="(.+)"/)[1]
    #   quiz_block[:attributes] = {
    #     'content': "PLACEHOLDER FOR AN EXERCISE\nOld quizzes id: " + quiz_id,
    #     'dropCap': false,
    #   }
    #   json_content << quiz_block
    #   @tag_depth = @tag_depth - 1
    # else
      quiz_id = line.match(/id="(.+)"/)[1]
      quiz_data = fetch_quiz_details_by_id(quiz_id)
      parsed_quiz_data = JSON.parse(quiz_data)

      puts parsed_quiz_data

      exercise_id = SecureRandom.uuid
      exercise_slide_id = SecureRandom.uuid
      exercise_task_id = SecureRandom.uuid

      json_content << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'moocfi/exercise',
        'attributes': {
          'id': exercise_id,
        },
        'innerBlocks': [],
      }

      @normalized_exercises << {
        'id': exercise_id,
        'name': parsed_quiz_data['title'],
        'order_number': @exercise_count,
        'score_maximum': parsed_quiz_data['points'],
        'max_tries_per_slide': nil,
        'limit_number_of_tries': parsed_quiz_data['triesLimited'],
        'deadline': nil,
        'needs_peer_review': false,
        'needs_self_review': false,
        'peer_or_self_review_config': nil,
        'peer_or_self_review_questions': nil,
        'use_course_default_peer_or_self_review_config': true,
        'teacher_reviews_answer_after_locking': true,
      }
      @normalized_exercise_slides << {
        'id': exercise_slide_id,
        'exercise_id': exercise_id,
        'order_number': 0,
      }
      @normalized_exercise_tasks << {
        'id': exercise_task_id,
        'exercise_slide_id': exercise_slide_id,
        'assignment': [
          {
            'clientId': SecureRandom.uuid,
            'isValid': true,
            'name': 'core/paragraph',
            'attributes': {
              'content': parsed_quiz_data['body'] || '',
              'dropCap': false,
            },
            'innerBlocks': [],
          },
        ],
        'exercise_type': 'quizzes',
        'private_spec': parsed_quiz_data,
        'order_number': 0,
      }

      @exercise_count += 1
      @tag_depth = @tag_depth - 1 if line.end_with?('</quiz>') || oneliner
    # end
  end

  def handle_image(line, json_block, file, json_content)
    path_to_current_file = file.rpartition('/')[0]

    attributes = {}
    # regex to get key-value pairs in the img tag
    line.scan(/(\w+)=(["'])(.*?)\2|(\w+)=([^'">\s]+)/) do |match|
      key, _, quoted_value, unquoted_key, unquoted_value = match

      # convert relative path to absolute path
      if key && quoted_value && key == 'src'
        quoted_value = File.expand_path(quoted_value, path_to_current_file)
      elsif unquoted_key == 'src'
        unquoted_value = File.expand_path(unquoted_value, path_to_current_file)
      end

      if key
        attributes[key.to_sym] = quoted_value
      else
        attributes[unquoted_key.to_sym] = unquoted_value
      end
    end

    width = ''
    width = attributes[:width] if attributes[:width]
    width = attributes[:style].match(/width: (\d+)px/)[1] if attributes[:style] && attributes[:style].match?(/width: (\d+)px/)

    src_path = attributes[:src]
    uploaded_url = upload_extra_file(src_path)

    image_block = create_new_block
    image_block[:name] = 'core/image'
    image_block[:attributes] = {
      'alt': attributes[:alt] ? attributes[:alt] : 'Add alt',
      'blurDataUrl': '',
      'caption': '',
      'height': 'auto',
      'href': uploaded_url,
      'linkDestination': 'media',
      'sizeSlug': 'full',
      'url': uploaded_url,
      'width': width,
    }

    if @tag_depth > 0 && json_block[:name] == 'core/paragraph'
      json_content << json_block
      json_content << image_block
      json_content << create_new_block
    elsif @tag_depth > 0
      json_block[:innerBlocks] << image_block
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/paragraph',
        'attributes': {
          'content': '',
          'dropCap': false,
        },
        'innerBlocks': [],
      }
    else
      json_content << image_block
    end

    # @inside_a_block = false
    @tag_depth = @tag_depth - 1
  end

  def fetch_quiz_details_by_id(id)
    quiz_data = RestClient.get "https://quizzes.mooc.fi/api/v2/dashboard/quizzes/#{id}", { Authorization: ENV['TMC_TOKEN'] }
  end

  def upload_extra_file(file)
    return @uploaded_extra_files[file] if @uploaded_extra_files.key?(file)

    puts "Uploading file #{file} to courses.mooc.fi"
    course_id = ENV['COURSE_ID']
    cookies = { 'session' => ENV['UPLOAD_AUTH_COOKIE'] }

    begin
      payload = { file: File.new(file, 'rb') }
      response = RestClient::Request.execute(
        method: :post,
        url: "https://project-331.local/api/v0/cms/courses/#{course_id}/upload",
        payload: payload,
        cookies: cookies,
        verify_ssl: OpenSSL::SSL::VERIFY_NONE
      )
      url = JSON.parse(response.body)["url"] rescue nil
      puts "Uploaded #{file}: #{url || response.code}"
      @uploaded_extra_files[file] = url if url
    rescue RestClient::ExceptionWithResponse => e
      puts "Failed to upload #{file}: #{e.response}"
    rescue StandardError => e
      puts "An error occurred while uploading #{file}: #{e.message}"
    end

    url
  end

  def upload_extra_files
    extra_files = Dir.glob("#{@directory}**/*.{png,jpg,jpeg,svg,pdf}")
    puts "found #{extra_files.count} extra files (png, jpg, jpeg, svg and pdf)"

    course_id = ENV['COURSE_ID']
    cookies = { 'session' => ENV['UPLOAD_AUTH_COOKIE'] }

    uploaded_urls = {}

    extra_files.each do |file|
      begin
        payload = { file: File.new(file, 'rb') }
        response = RestClient::Request.execute(
          method: :post,
          url: "https://project-331.local/api/v0/cms/courses/#{course_id}/upload",
          payload: payload,
          cookies: cookies,
          verify_ssl: OpenSSL::SSL::VERIFY_NONE
        )
        url = JSON.parse(response.body)["url"] rescue nil
        puts "Uploaded #{file}: #{url || response.code}"
        uploaded_urls[file] = url if url
      rescue RestClient::ExceptionWithResponse => e
        puts "Failed to upload #{file}: #{e.response}"
      rescue StandardError => e
        puts "An error occurred while uploading #{file}: #{e.message}"
      end
    end

    uploaded_urls
  end

  def handle_br(json_block, json_content)
    # if @inside_a_block && @current_tag_type == 'quiz'
    if @tag_depth > 0 && @current_tag_type == 'quiz'
      # json_block[:innerBlocks].last[:innerBlocks].last[:innerBlocks].last[:innerBlocks].last[:attributes][:content] << '<br>'
      append_to_last_block_content(json_block, '<br>')
    # elsif @inside_a_block
    elsif @tag_depth > 0
      #json_block[:innerBlocks].last[:attributes][:content] << '<br>'
      append_to_last_block_content(json_block, '<br>')
    else
      json_content << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/paragraph',
        'attributes': {
          'content': '<br>',
          'dropCap': false,
        },
        'innerBlocks': [],
      }
    end
  end

  def handle_iframe(line, json_block, json_content)
    src = line.match(/src="(.+)"/)[1]
    if src.include?('youtube.com')
      video_key = src.match(/embed\/([^?]+)/)[1] if src.include?('embed')
      json_block[:name] = 'core/embed'
      json_block[:attributes] = {
        "caption": "",
        "providerNameSlug": "youtube",
        "allowResponsive": true,
        "responsive": true,
        "previewable": true,
        "url":  video_key ? "https://www.youtube.com/watch?v=#{video_key}": src,
        "type": "video",
        "className": "wp-embed-aspect-16-9 wp-has-aspect-ratio"
      }
    elsif src.include?('vimeo.com')
      video_key = src.match(/video\/([^?]+)/)[1] if src.include?('video')
      json_block[:name] = 'core/embed'
      json_block[:attributes] = {
        "caption": "",
        "providerNameSlug": "vimeo",
        "allowResponsive": true,
        "responsive": true,
        "previewable": true,
        "url": video_key ? "https://vimeo.com/#{video_key}" : src,
        "type": "video",
        "className": "wp-embed-aspect-16-9 wp-has-aspect-ratio"
      }
    else
      json_block[:name] = 'moocfi/iframe'
      json_block[:attributes] = {
        'src': src,
      }
    end

    json_block
  end

  def handle_span(line, json_block, json_content)
    # We just remove the span tag and any inline styles since secret project does styles in separate css


    styles = {}
    if (styles_match = line.match(/style="([^"]+)"/))
      styles_string = styles_match[1]

      styles_string.scan(/([\w-]+):\s*([^;]+);?/) do |key, value|
        styles[key.strip] = value.strip
      end
    end

    # styles = {}
    # styles_string = line.match(/style="([^"]+)"/)[1]

    # styles_string.scan(/([\w-]+):\s*([^;]+);?/) do |key, value|
    #   styles[key.strip] = value.strip
    # end

    if line.end_with?('</span>')
      # close the block
      @tag_depth = @tag_depth - 1
      # if tag depth is 0, append to json content
      # if tag depth is > 0, append to inner blocks
      if @tag_depth == 0
        json_content << json_block
      else
        append_to_last_block_content(json_block, line)
        # if json_block[:name] = 'moocfi/exercise'
        #   json_block[:innerBlocks].last[:innerBlocks].last[:innerBlocks].last[:innerBlocks].last[:attributes][:content] << line
        # else
        #   json_block[:innerBlocks].last[:attributes][:content] << line
        # end
      end
    else
      # if the line doesn't end in the closing tag, don't close the block
      # instead create a new block and append it to inner blocks so that the content can be added to it
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/paragraph',
        'attributes': {
          'content': line,
          'dropCap': false,
        },
        'innerBlocks': [],
      }
    end
  end
end

def convert_markdown_links_to_html(line)
  markdown_link_regex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/

  line.gsub(markdown_link_regex) do
    link_text = Regexp.last_match(1)
    url = Regexp.last_match(2)
    "<a href=\"#{url}\">#{link_text}</a>"
  end
end

def append_to_last_block_content(json_block, new_content)
  if json_block[:innerBlocks] && !json_block[:innerBlocks].empty?
    append_to_last_block_content(json_block[:innerBlocks].last, new_content)
  else
    if json_block[:attributes] && json_block[:attributes][:content]
      json_block[:attributes][:content] += new_content
    else
      json_block[:attributes] = {
        'content': new_content,
        'dropCap': false,
      }
    end
  end
end

if ARGV.empty?
  raise ArgumentError, 'Usage: ruby migrate-material.rb <path>, where path is the directory where the material is located.'
  exit
end

if __FILE__ == $PROGRAM_NAME
  directory = ARGV[0]
  MaterialMigrator.new(directory)
end
