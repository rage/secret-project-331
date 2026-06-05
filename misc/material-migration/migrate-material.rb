#!/usr/bin/env ruby

require 'json'
require 'securerandom'
require 'rest-client'
require 'dotenv/load'
require 'pathname'
require 'kramdown'

class MaterialMigrator
  def initialize(directory)
    unless File.directory?(directory)
      raise ArgumentError, "#{directory} is not a directory."
    end

    @directory = directory.end_with?('/') ? directory : "#{directory}/"
    @files = Dir.glob("#{@directory}**/*").sort
    # @uuid = SecureRandom.uuid
    # @inside_a_block = false
    @inside_frontmatter = false
    @current_tag_type = ''
    @tag_depth = 0
    @known_tags = [
      'styled-text', 'text-box', 'div', 'quiz', 'img', 'iframe', 'span',
      # Custom course components
      'sub-heading', 'caption-text', 'floating-image', 'detail-tag', 'quote',
      'chart', 'area-chart', 'bar-chart', 'chart-switcher',
      'sub-topic', 'medium-content', 'topic-hero', 'topic-content',
      'hero-section', 'placeholder', 'core-team', 'faq', 'introduction',
      'teaser-question', 'teaser-card',
      'homepage-grid', 'course-grid', 'start-hero', 'error-hero',
      # Standard HTML block elements used inside custom components
      'details', 'summary', 'ul', 'ol', 'li', 'p',
      # HTML table elements
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      # HTML inline elements (needed for depth tracking when used inside custom blocks)
      'a',
    ]
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
      @floating_image_size = nil

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
    @subtitle = nil
    @home_page = false
    @page_title = nil
    @page_path = nil
    @is_section_index_page = section_index_page?(file)

    json_block = create_new_block

    # Processed as a worklist rather than a plain each so a line that holds an opening
    # tag followed by trailing content (handled below) can re-queue that content.
    lines = content.split("\n")
    until lines.empty?
      line = lines.shift
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

      if markdown_image_line?(line)
        handle_markdown_image(line, json_block, file, json_content)
        next
      end

      if line.start_with?('<') && line.end_with?('>')
        if line.end_with?('/>')
          self_closing_type = line.match(/<([a-zA-Z0-9_-]+)/)[1]
          case self_closing_type
          when 'vocabulary'
            json_content << {
              'clientId': SecureRandom.uuid,
              'isValid': true,
              'name': 'moocfi/glossary',
              'attributes': {},
              'innerBlocks': [],
            }
          when 'img'
            path_to_current_file = file.rpartition('/')[0]
            img_attrs = {}
            line.scan(/(\w+)=(["'])(.*?)\2|(\w+)=([^'">\s\/]+)/) do |m|
              key, _, qv, uk, uv = m
              qv = File.expand_path(qv, path_to_current_file) if key == 'src' && qv
              uv = File.expand_path(uv, path_to_current_file) if uk == 'src'
              img_attrs[key.to_sym] = qv if key
              img_attrs[uk.to_sym] = uv if uk
            end
            width = img_attrs[:width] || ''
            image_block = build_image_block(img_attrs[:src], img_attrs[:alt], width)
            if @tag_depth > 0 && json_block[:name] == 'core/paragraph'
              json_content << json_block
              json_content << image_block
              json_content << create_new_block
            elsif @tag_depth > 0
              json_block[:innerBlocks] << image_block
            else
              json_content << image_block
            end
          else
            puts "skipping oneliner tag on line #{line}"
          end
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


        json_block = handle_block(tag_type, line, json_block, file, json_content) || json_block
        next
      end

      # Case A: a line that begins with a complete opening tag <tag ...> but has trailing
      # content after it (so it didn't end with '>' and the block above missed it), where
      # the element does NOT also close on this same line. This is a well-formed multi-line
      # component whose body simply starts on the opening-tag line. Handle the opening tag,
      # then re-queue the trailing content so it's processed as the block's body on the next
      # iteration (with @tag_depth now incremented). Subsequent lines and the eventual
      # </tag> are already handled by the existing logic. We require a known tag and skip
      # lines where </tag> appears, so inline elements like "<a href>x</a> more" are left to
      # the normal text path instead of being mistaken for a block open.
      unless line.start_with?('</', '<!--')
        open_match = line.match(/\A(<([a-zA-Z0-9_-]+)(?:\s[^>]*)?>)(.+)\z/m)
        if open_match && @known_tags.include?(open_match[2]) && !line.include?("</#{open_match[2]}>")
          opening_tag = open_match[1]
          tag_type = open_match[2]
          remainder = open_match[3].strip
          @tag_depth += 1
          @current_tag_type = tag_type
          json_block = handle_block(tag_type, opening_tag, json_block, file, json_content) || json_block
          lines.unshift(remainder) unless remainder.empty?
          next
        end
      end

      # if @inside_a_block
        if @tag_depth > 0
          if line.start_with?('#')
            json_block = handle_header(line, json_block, json_content)
            next
          end
          if line.match?(/^\s*\d+\.\s+/)
            handle_numbered_list_item(line, json_block)
            next
          end
        # Convert any inline markdown in the line to HTML (links, emphasis, code, ...).
        line = convert_inline_markdown(line)
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
        if line.start_with?('#')
          handle_header(line, json_block, json_content)
        elsif line.match?(/^\s*\d+\.\s+/)
          handle_numbered_list_item(line, json_content.last || json_block)
        else
          json_content << {
            'clientId': SecureRandom.uuid,
            'isValid': true,
            'name': 'core/paragraph',
            'attributes': {
              'content': convert_inline_markdown(line),
              'dropCap': false,
            },
            'innerBlocks': [],
          }
        end
      end
    end

    # Safeguard in case a tag wasn't closed properly
    if @tag_depth > 0
      json_content << json_block
    end

    # The placeholder body is collected into a single paragraph with <br> separators
    # and newlines. Split it into discrete paragraph blocks so it renders correctly.
    normalize_copy_text_blocks(json_content)

    metadata = build_page_metadata(file, json_content)
    wrapped_content = {
      'content': json_content,
      'exercises': @normalized_exercises,
      'exercise_slides': @normalized_exercise_slides,
      'exercise_tasks': @normalized_exercise_tasks,
      'title': metadata[:title],
      'subtitle': @subtitle,
      'url_path': metadata[:url_path],
      'chapter_id': nil,
      'hidden': @hidden,
      'home_page': @home_page && metadata[:url_path] == "/",
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

    chapter_slug = path_parts.reverse.find { |part| part.match?(/^(chapter|part)-\d+$/) }

    chapter_number = if chapter_slug
      chapter_slug.match(/^(?:chapter|part)-(\d+)$/)&.captures&.first&.to_i
    end
    chapter_title = chapter_number ? "Chapter #{chapter_number}" : nil

    title = extract_title_from_blocks(json_content) || page_slug.tr('-', ' ').split.map(&:capitalize).join(' ')
    url_path = if @home_page && @page_path && !@page_path.empty?
      @page_path
    elsif @home_page
      "/"
    elsif chapter_slug
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

    if @is_section_index_page
      case key
      when 'title'
        json_block[:attributes][:title] ||= normalize_title(value)
      when 'topic'
        json_block[:attributes][:title] = normalize_title(value)
      when 'subTitle', 'subtitle'
        normalized_value = normalize_title(value)
        json_block[:attributes][:subtitle] = normalized_value
        @subtitle = normalized_value
      when 'hidden'
        normalized_value = value.to_s.downcase.delete_prefix('"').delete_suffix('"').delete_prefix("'").delete_suffix("'")
        @hidden = normalized_value == 'true'
      end
      return
    end

    case key
    when 'title'
      json_block[:attributes][:title] = normalize_title(value)
      @page_title = normalize_title(value)
    when 'topic'
      normalized_value = normalize_title(value)
      json_block[:attributes][:subtitle] = normalized_value
      @subtitle = normalized_value
    when 'subTitle'
      normalized_value = normalize_title(value)
      json_block[:attributes][:subtitle] ||= normalized_value
      @subtitle ||= normalized_value
    when 'hidden'
      normalized_value = value.to_s.downcase.delete_prefix('"').delete_suffix('"').delete_prefix("'").delete_suffix("'")
      @hidden = normalized_value == 'true'
    when 'home_page'
      @home_page = value.to_s.strip == 'true'
    when 'path'
      @page_path = value.to_s.strip.gsub(/^["']|["']$/, '')
    end
  end

  def section_index_page?(file)
    file.match?(%r{/(?:chapter|part)-\d+/index\.md\z})
  end

  def handle_block(tag_type, line, json_block, file, json_content)
    @current_tag_type = tag_type
    accepted_oneliners = [
      'styled-text', 'text-box', 'div', 'quiz', 'img', 'iframe', 'span', 'quiz',
      'sub-heading', 'caption-text', 'quote', 'chart', 'area-chart', 'bar-chart', 'chart-switcher',
      'homepage-grid', 'course-grid', 'hero-section', 'introduction', 'core-team', 'faq',
      'teaser-card',
      'summary', 'li', 'p', 'th', 'td',
    ]
    if line.start_with?("<#{tag_type}") && line.end_with?("</#{tag_type}>") && !accepted_oneliners.include?(tag_type)
      puts "skipping oneliner tag #{tag_type} on line #{line}"
      @tag_depth = @tag_depth - 1
      return json_block
    end

    result = case tag_type
    when 'styled-text'
      handle_paragraph(json_block, json_content)
    when 'text-box'
      handle_text_box(line, json_block)
    when 'floating-image'
      handle_floating_image(line)
    when 'div', 'detail-tag', 'topic-hero', 'topic-content', 'details', 'ul', 'ol',
         'table', 'thead', 'tbody', 'tr', 'a'
      handle_div(line, json_block)
    when 'quiz'
      handle_quiz(line, json_block, json_content)
    when 'img'
      handle_image(line, json_block, file, json_content)
    when 'iframe'
      handle_iframe(line, json_block, json_content)
    when 'span'
      handle_span(line, json_block, json_content)
    when 'sub-heading'
      handle_sub_heading(line, json_block, json_content)
    when 'caption-text'
      handle_caption_text(line, json_block, json_content)
    when 'quote'
      handle_quote(line, json_block, json_content)
    when 'chart', 'area-chart', 'bar-chart', 'chart-switcher'
      handle_chart(tag_type, line, json_block, json_content)
    when 'sub-topic', 'medium-content'
      handle_sub_topic(line, json_block)
    when 'hero-section'
      handle_hero_section_tag(line, json_block, json_content)
    when 'start-hero', 'error-hero'
      handle_landing_hero_tag(line, json_block)
    when 'placeholder'
      handle_placeholder_tag(line, json_block)
    when 'homepage-grid', 'course-grid'
      handle_course_grid_tag(json_block, json_content)
    when 'core-team'
      handle_core_team_tag(json_block, json_content)
    when 'introduction'
      handle_introduction_tag(line, json_block, json_content)
    when 'teaser-question'
      handle_teaser_question_tag(line, json_block, json_content)
    when 'teaser-card'
      handle_teaser_card_tag(line, json_block, json_content)
    when 'faq'
      handle_skip_tag
    when 'p'
      handle_p_tag(line, json_block, json_content)
    when 'summary', 'li', 'th', 'td'
      handle_inline_html_tag(line, tag_type, json_block)
    else
      puts "unknown tag type: #{tag_type}"
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
    background_color = extract_quoted_attribute(line, 'background')
    attrs[:backgroundColor] = background_color if background_color
    json_block[:attributes] = attrs
    name = extract_quoted_attribute(line, 'name')
    if name && !name.empty?
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/heading',
        'attributes': {
          'content': "<strong>#{name}</strong>",
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

  def handle_text_box(line, json_block)
    json_block[:name] = 'moocfi/aside'
    json_block[:attributes] = { backgroundColor: '#ebf5fb', separatorColor: '#007acc' }
    title = extract_quoted_attribute(line, 'title')
    if title && !title.empty?
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/heading',
        'attributes': { 'content': "<strong>#{title}</strong>", 'level': 2 },
        'innerBlocks': [],
      }
    end
    json_block[:innerBlocks] << {
      'clientId': SecureRandom.uuid,
      'isValid': true,
      'name': 'core/paragraph',
      'attributes': { 'content': '', 'dropCap': false },
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

  def handle_floating_image(line)
    height = extract_quoted_attribute(line, 'height')
    @floating_image_size = height ? height.to_i : 150
  end

  def handle_numbered_list_item(line, json_block)
    content = convert_inline_markdown(line.sub(/^\s*\d+\.\s+/, '').strip)
    list_item = {
      'clientId': SecureRandom.uuid,
      'isValid': true,
      'name': 'core/list-item',
      'attributes': { 'content': content },
      'innerBlocks': [],
    }
    last = json_block[:innerBlocks].last
    if last && last[:name] == 'core/list' && last[:attributes][:ordered]
      last[:innerBlocks] << list_item
    else
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/list',
        'attributes': { 'ordered': true, 'values': '' },
        'innerBlocks': [list_item],
      }
    end
  end

  def handle_header(line, json_block, json_content)
    level = line.match(/^#+/)[0].length

    header_block = create_new_block
    header_block[:name] = 'core/heading'
    header_block[:attributes] = {
      'content': convert_inline_markdown(line.gsub(/^#+/, '').strip),
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
      quiz_id = extract_quoted_attribute(line, 'id')
      unless quiz_id
        raise ArgumentError, "quiz tag is missing an id attribute: #{line}"
      end
      quiz_data = fetch_quiz_details_by_id(quiz_id)
      parsed_quiz_data = JSON.parse(quiz_data)
      (parsed_quiz_data['items'] || []).each do |item|
        item['direction'] = 'column'
      end

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
    from_floating_image = !@floating_image_size.nil?

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

    if from_floating_image
      width = @floating_image_size.to_s
      @floating_image_size = nil
    else
      width = ''
      width = attributes[:width].to_s.gsub(/[^0-9]/, '') if attributes[:width]
      width = attributes[:style].match(/width: (\d+)px/)[1] if attributes[:style] && attributes[:style].match?(/width: (\d+)px/)
    end

    src_path = attributes[:src]
    image_block = build_image_block(src_path, attributes[:alt], width)

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

  def handle_markdown_image(line, json_block, file, json_content)
    path_to_current_file = file.rpartition('/')[0]
    match = line.match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)$/)
    unless match
      puts "skipping malformed markdown image on line #{line}"
      return
    end

    alt_text = match[1]
    src_path = File.expand_path(match[2], path_to_current_file)
    image_block = build_image_block(src_path, alt_text, '')

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

    @tag_depth = @tag_depth - 1 if @tag_depth > 0
  end

  def fetch_quiz_details_by_id(id)
    RestClient.get "https://quizzes.mooc.fi/api/v2/dashboard/quizzes/#{id}", { Authorization: ENV['TMC_TOKEN'] }
  rescue RestClient::ExceptionWithResponse => e
    puts "Failed to fetch quiz #{id}: HTTP #{e.response.code} - #{e.response.body}"
    nil
  rescue RestClient::Exceptions::OpenTimeout, RestClient::Exceptions::ReadTimeout => e
    puts "Timeout fetching quiz #{id}: #{e.message}"
    nil
  rescue StandardError => e
    puts "Error fetching quiz #{id}: #{e.message}"
    nil
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
        url: "#{ENV['BASE_URL']}/api/v0/cms/courses/#{course_id}/upload",
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
          url: "#{ENV['BASE_URL']}/api/v0/cms/courses/#{course_id}/upload",
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

  def build_image_block(src_path, alt_text, width)
    uploaded_url = upload_extra_file(src_path)

    image_block = create_new_block
    image_block[:name] = 'core/image'
    image_block[:attributes] = {
      'alt': alt_text && !alt_text.empty? ? alt_text : 'Add alt',
      'blurDataUrl': '',
      'caption': '',
      'height': 'auto',
      'href': uploaded_url,
      'linkDestination': 'media',
      'sizeSlug': 'full',
      'url': uploaded_url,
      'width': width,
    }

    image_block
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
    src = extract_quoted_attribute(line, 'src')
    unless src
      raise ArgumentError, "iframe tag is missing a src attribute: #{line}"
    end
    embed = build_video_embed_block(src)
    block = if embed
      embed
    else
      b = create_new_block
      b[:name] = 'moocfi/iframe'
      b[:attributes] = { 'src': src }
      b
    end

    if @tag_depth > 1
      json_block[:innerBlocks] << block
      @tag_depth -= 1
      json_block
    else
      json_content << block
      @tag_depth -= 1
      create_new_block
    end
  end

  def handle_span(line, json_block, json_content)
    # We just remove the span tag and any inline styles since secret project does styles in separate css


    styles = {}
    if (styles_string = extract_quoted_attribute(line, 'style'))

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

  def handle_sub_heading(line, json_block, json_content)
    match = line.match(/<sub-heading[^>]*>(.*?)<\/sub-heading>/)
    content = match ? convert_inline_markdown(match[1].strip) : ''

    heading_block = create_new_block
    heading_block[:name] = 'core/heading'
    heading_block[:attributes] = { 'content': content, 'level': 3 }

    if @tag_depth > 1
      json_block[:innerBlocks] << heading_block
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/paragraph',
        'attributes': { 'content': '', 'dropCap': false },
        'innerBlocks': [],
      }
    else
      json_content << heading_block
    end

    @tag_depth -= 1
    create_new_block
  end

  def handle_caption_text(line, json_block, json_content)
    if line.include?('</caption-text>')
      match = line.match(/<caption-text[^>]*>(.*?)<\/caption-text>/)
      content = match ? convert_inline_markdown(match[1].strip) : ''
      para = create_new_block
      para[:attributes] = { 'content': "<em>#{content}</em>", 'dropCap': false }
      if @tag_depth > 1
        json_block[:innerBlocks] << para
      else
        json_content << para
      end
      @tag_depth -= 1
      return create_new_block
    end
    if @tag_depth > 1
      # Inside another block: use div-like behavior to preserve the outer container
      handle_div(line, json_block)
    else
      json_block[:name] = 'core/paragraph'
      json_block[:attributes] = { 'content': '', 'dropCap': false }
      json_block
    end
  end

  def handle_quote(line, json_block, json_content)
    if line.include?('</quote>')
      match = line.match(/<quote[^>]*>(.*?)<\/quote>/)
      content = match ? convert_inline_markdown(match[1].strip) : ''
      quote_block = create_new_block
      quote_block[:name] = 'core/quote'
      quote_block[:attributes] = { 'citation': '' }
      quote_block[:innerBlocks] = [{
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/paragraph',
        'attributes': { 'content': content, 'dropCap': false },
        'innerBlocks': [],
      }]
      json_content << quote_block
      @tag_depth -= 1
      return create_new_block
    end
    if @tag_depth > 1
      # Inside another block: use div-like behavior to preserve the outer container
      handle_div(line, json_block)
    else
      # At top level: transform json_block into a core/quote
      json_block[:name] = 'core/quote'
      json_block[:attributes] = { 'citation': '' }
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/paragraph',
        'attributes': { 'content': '', 'dropCap': false },
        'innerBlocks': [],
      }
      json_block
    end
  end

  def handle_chart(tag_type, line, json_block, json_content)
    content = if tag_type == 'chart-switcher'
      chart1_id = extract_quoted_attribute(line, 'chart1') || 'unknown'
      chart2_id = extract_quoted_attribute(line, 'chart2') || 'unknown'
      "[Chart switcher: #{chart1_id} / #{chart2_id}]"
    else
      chart_id = extract_quoted_attribute(line, 'chart') || 'unknown'
      "[Chart: #{chart_id}]"
    end
    para = create_new_block
    para[:attributes] = { 'content': content, 'dropCap': false }
    if @tag_depth > 1
      json_block[:innerBlocks] << para
    else
      json_content << para
    end
    @tag_depth -= 1
    create_new_block
  end

  def handle_sub_topic(line, json_block)
    json_block[:name] = 'moocfi/infobox'
    json_block[:attributes] = { 'noPadding': false }
    title = extract_quoted_attribute(line, 'title')
    if title && !title.empty?
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/heading',
        'attributes': { 'content': "<strong>#{title}</strong>", 'level': 2 },
        'innerBlocks': [],
      }
    end
    json_block[:innerBlocks] << {
      'clientId': SecureRandom.uuid,
      'isValid': true,
      'name': 'core/paragraph',
      'attributes': { 'content': '', 'dropCap': false },
      'innerBlocks': [],
    }
    json_block
  end

  # Walks the content tree and rewrites each moocfi/landing-page-copy-text block so
  # the prose collected into a single paragraph (with <br> separators and stray
  # newlines) becomes one core/paragraph per logical paragraph.
  def normalize_copy_text_blocks(blocks)
    blocks.each do |block|
      if block[:name] == 'moocfi/landing-page-copy-text'
        split_paragraphs_in_copy_text(block)
      end
      inner = block[:innerBlocks]
      normalize_copy_text_blocks(inner) if inner.is_a?(Array)
    end
  end

  def split_paragraphs_in_copy_text(copy_text_block)
    columns = Array(copy_text_block[:innerBlocks]).find { |b| b[:name] == 'core/columns' }
    return unless columns

    Array(columns[:innerBlocks]).each do |column|
      next unless column[:name] == 'core/column'

      rebuilt = []
      Array(column[:innerBlocks]).each do |inner|
        if inner[:name] == 'core/paragraph'
          content = inner[:attributes] && (inner[:attributes][:content] || inner[:attributes]['content'])
          paragraph_texts = split_into_paragraphs(content.to_s)
          if paragraph_texts.empty?
            # Preserve an empty paragraph so the block isn't left contentless.
            rebuilt << inner
          else
            paragraph_texts.each do |text|
              rebuilt << {
                'clientId': SecureRandom.uuid, 'isValid': true,
                'name': 'core/paragraph',
                'attributes': { 'content': text, 'dropCap': false },
                'innerBlocks': [],
              }
            end
          end
        else
          rebuilt << inner
        end
      end
      column[:innerBlocks] = rebuilt
    end
  end

  # Splits prose on <br> separators, collapsing the stray newlines that the parser
  # accumulated within each segment into single spaces. Returns trimmed, non-empty
  # paragraph strings.
  def split_into_paragraphs(content)
    content.split(/<br\s*\/?>/i).map do |segment|
      segment.gsub(/\s*\n\s*/, ' ').strip
    end.reject(&:empty?)
  end

  def handle_placeholder_tag(line, json_block)
    title = extract_quoted_attribute(line, 'title')
    if @home_page
      # On the home page, <placeholder> maps to the LMS landing-page-copy-text block,
      # wrapped in columns so text can be laid out in the standard two-column pattern.
      json_block[:name] = 'moocfi/landing-page-copy-text'
      json_block[:attributes] = {}
      column_block = {
        'clientId': SecureRandom.uuid, 'isValid': true,
        'name': 'core/column',
        'attributes': {},
        'innerBlocks': [],
      }
      if title && !title.empty?
        column_block[:innerBlocks] << {
          'clientId': SecureRandom.uuid, 'isValid': true,
          'name': 'core/heading',
          'attributes': { 'content': title, 'level': 2 },
          'innerBlocks': [],
        }
      end
      column_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid, 'isValid': true,
        'name': 'core/paragraph',
        'attributes': { 'content': '', 'dropCap': false },
        'innerBlocks': [],
      }
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid, 'isValid': true,
        'name': 'core/columns',
        'attributes': { 'isStackedOnMobile': true },
        'innerBlocks': [column_block],
      }
    else
      json_block[:name] = 'moocfi/aside'
      json_block[:attributes] = {}
      if title && !title.empty?
        json_block[:innerBlocks] << {
          'clientId': SecureRandom.uuid, 'isValid': true,
          'name': 'core/heading',
          'attributes': { 'content': title, 'level': 2 },
          'innerBlocks': [],
        }
      end
      json_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid, 'isValid': true,
        'name': 'core/paragraph',
        'attributes': { 'content': '', 'dropCap': false },
        'innerBlocks': [],
      }
    end
    json_block
  end

  def handle_hero_section_tag(line, json_block, json_content)
    title = (@home_page ? @page_title : nil) || extract_quoted_attribute(line, 'title') || ''
    text = extract_quoted_attribute(line, 'text') || ''
    hero_block = create_new_block
    hero_block[:name] = 'moocfi/landing-page-hero-section'
    hero_block[:attributes] = { 'title': title }
    unless text.empty?
      hero_block[:innerBlocks] << {
        'clientId': SecureRandom.uuid,
        'isValid': true,
        'name': 'core/paragraph',
        'attributes': {
          'content': text,
          'dropCap': false,
        },
        'innerBlocks': [],
      }
    end
    json_content << hero_block
    @tag_depth -= 1
    create_new_block
  end

  def handle_introduction_tag(line, json_block, json_content)
    src = extract_quoted_attribute(line, 'src') || find_component_video_url('introduction')
    if src
      embed = build_video_embed_block(src)
      json_content << embed if embed
    end
    @tag_depth -= 1
    create_new_block
  end

  # Converts a kebab-case tag name to PascalCase, then searches the course source
  # tree for a matching component file and returns the first video URL found in it.
  # Returns nil if no matching component or video URL is found.
  def find_component_video_url(tag_name)
    component_name = tag_name.split('-').map(&:capitalize).join
    course_root = File.dirname(@directory.chomp('/'))
    component_files = Dir.glob(File.join(course_root, '**', "#{component_name}.{js,jsx,ts,tsx}"))
    component_files.each do |path|
      content = File.read(path)
      match = content.match(/src\s*=\s*["']([^"']*(?:vimeo|youtube|youtu\.be)[^"']*)["']/)
      return match[1] if match
    end
    nil
  end

  def build_video_embed_block(src)
    if src.include?('vimeo.com')
      video_key = src.match(%r{vimeo\.com/(?:video/)?([^?/]+)})&.captures&.first
      return nil unless video_key

      embed = create_new_block
      embed[:name] = 'core/embed'
      embed[:attributes] = {
        'caption': '',
        'providerNameSlug': 'vimeo',
        'allowResponsive': true,
        'responsive': true,
        'previewable': true,
        'url': "https://vimeo.com/#{video_key}",
        'type': 'video',
        'className': 'wp-embed-aspect-16-9 wp-has-aspect-ratio',
      }
      embed
    elsif src.include?('youtube.com') || src.include?('youtu.be')
      video_key = src.match(/(?:embed\/|v=|youtu\.be\/)([^?&]+)/)&.captures&.first
      return nil unless video_key

      embed = create_new_block
      embed[:name] = 'core/embed'
      embed[:attributes] = {
        'caption': '',
        'providerNameSlug': 'youtube',
        'allowResponsive': true,
        'responsive': true,
        'previewable': true,
        'url': "https://www.youtube.com/watch?v=#{video_key}",
        'type': 'video',
        'className': 'wp-embed-aspect-16-9 wp-has-aspect-ratio',
      }
      embed
    end
  end

  def handle_landing_hero_tag(line, json_block)
    json_block[:name] = 'moocfi/landing-page-hero-section'
    title = extract_quoted_attribute(line, 'title') || ''
    json_block[:attributes] = { 'title': title }
    json_block
  end

  def handle_course_grid_tag(json_block, json_content)
    grid_block = create_new_block
    grid_block[:name] = 'moocfi/course-chapter-grid'
    grid_block[:attributes] = {}
    json_content << grid_block
    @tag_depth -= 1
    create_new_block
  end

  def handle_core_team_tag(json_block, json_content)
    author_block = create_new_block
    author_block[:name] = 'moocfi/author'
    author_block[:attributes] = {}
    json_content << author_block
    @tag_depth -= 1
    create_new_block
  end

  def handle_skip_tag
    @tag_depth -= 1
    create_new_block
  end

  def handle_p_tag(line, json_block, json_content)
    if line.include?('</p>')
      match = line.match(/<p[^>]*>(.*?)<\/p>/)
      content = match ? convert_inline_markdown(match[1].strip) : ''
      content = '' if content == '&nbsp;'
      if @tag_depth > 1
        append_to_last_block_content(json_block, content + "\n") unless content.empty?
        @tag_depth -= 1
        return json_block
      else
        para = create_new_block
        para[:attributes] = { 'content': content, 'dropCap': false }
        json_content << para unless content.empty?
        @tag_depth -= 1
        return create_new_block
      end
    end
    # Multi-line <p>: transparent container like div
    handle_div(line, json_block)
  end

  def handle_inline_html_tag(line, tag_type, json_block)
    match = line.match(/<#{Regexp.escape(tag_type)}[^>]*>(.*?)<\/#{Regexp.escape(tag_type)}>/m)
    content = match ? convert_inline_markdown(match[1].strip) : ''
    append_to_last_block_content(json_block, content + "\n") unless content.empty?
    @tag_depth -= 1
    json_block
  end

  def handle_teaser_question_tag(line, json_block, json_content)
    title = extract_quoted_attribute(line, 'title') || ''
    json_block[:name] = 'moocfi/course-objective-section'
    json_block[:attributes] = { 'title': title }
    json_block[:innerBlocks] << {
      'clientId': SecureRandom.uuid, 'isValid': true,
      'name': 'core/columns',
      'attributes': { 'isStackedOnMobile': true },
      'innerBlocks': [],
    }
    json_block
  end

  def handle_teaser_card_tag(line, json_block, json_content)
    h5_match = line.match(/<[Hh]5[^>]*>(.*?)<\/[Hh]5>/i)
    heading_text = h5_match ? h5_match[1].strip : ''
    body_match = line.match(/<\/[Hh]5[^>]*>(.*?)<\/teaser-card>/i)
    body_text = body_match ? body_match[1].strip : ''

    column_block = {
      'clientId': SecureRandom.uuid, 'isValid': true,
      'name': 'core/column',
      'attributes': {},
      'innerBlocks': [
        {
          'clientId': SecureRandom.uuid, 'isValid': true,
          'name': 'core/heading',
          'attributes': { 'content': heading_text, 'level': 3, 'textAlign': 'center' },
          'innerBlocks': [],
        },
        {
          'clientId': SecureRandom.uuid, 'isValid': true,
          'name': 'core/paragraph',
          'attributes': { 'content': body_text, 'dropCap': false, 'align': 'center' },
          'innerBlocks': [],
        },
      ],
    }

    columns_block = json_block[:innerBlocks]&.find { |b| b[:name] == 'core/columns' }
    columns_block[:innerBlocks] << column_block if columns_block

    @tag_depth -= 1
    json_block
  end
end

def markdown_image_line?(line)
  line.match?(/^!\[[^\]]*\]\([^\)]+\)$/)
end

def extract_quoted_attribute(line, key)
  match = line.match(/#{Regexp.escape(key)}\s*=\s*(['"])(.*?)\1/)
  match && match[2].strip
end

# Converts inline markdown (links, emphasis, strong, code, images, escapes) to HTML
# using kramdown, so the migration is robust across courses that use varying markdown
# styles and mixed inline HTML.
#
# kramdown is document-oriented and wraps output in block tags, but we only want inline
# HTML here (content is appended into a single Gutenberg paragraph/heading). So we take
# the contents of a single wrapping <p>. If kramdown instead interpreted the line as a
# block construct (a list/blockquote/heading because it starts with -, *, >, #, N.), we
# preserve the literal leading marker and convert only the inline remainder, rather than
# injecting block-level tags into inline content.
def convert_inline_markdown(text)
  return text if text.nil? || text.empty?

  html = Kramdown::Document.new(text).to_html.strip

  if html.start_with?('<p>') && html.end_with?('</p>') && html.scan('<p>').length == 1
    html = html[3..-5].strip
    html = html.gsub(/(?<![="'>\/])(www\.[a-zA-Z0-9][a-zA-Z0-9\-.]*\.[a-zA-Z]{2,}(?:\/[^\s<>")\]]*)?)/) do |url|
      "<a href=\"https://#{url}\">#{url}</a>"
    end
    return html
  end

  block_marker = text.match(/\A(\s*(?:[-*+]\s+|\d+\.\s+|>\s+|\#{1,6}\s+))/)
  if block_marker
    marker = block_marker[1]
    return marker + convert_inline_markdown(text[marker.length..])
  end

  # kramdown produced something other than a single inline paragraph (e.g. the line
  # starts with a raw/custom HTML tag and was treated as an HTML block). We can't safely
  # inline-convert it, so return it untouched rather than risk mangling it.
  text
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
  abort 'Usage: ruby migrate-material.rb <path>, where path is the directory where the material is located.'
end

if __FILE__ == $PROGRAM_NAME
  directory = ARGV[0]
  MaterialMigrator.new(directory)
end
