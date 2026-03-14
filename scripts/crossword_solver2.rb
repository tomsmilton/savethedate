#!/usr/bin/env ruby
# Crossword puzzle generator v2 - more aggressive compactness optimization
require 'json'

WORDS_AND_CLUES = [
  ["PARIS", "The city where they got engaged"],
  ["DORIS", "The naughty border collie who ate the simnel cake"],
  ["SHEFFIELD", "The city these two call home"],
  ["MARCH", "The month it all began, 2021"],
  ["OCTOBER", "The month of the wedding"],
  ["TOMMIT", "What Inigo calls the groom"],
  ["CLIMBING", "Flora and Tom's shared passion — no ropes needed if you're bouldering"],
  ["MAMTOR", "The Peak District hill where it all started with a kiss"],
  ["SCOTT", "Tom's middle name"],
  ["AMODO", "Tom's design company"],
  ["FORTYTWO", "Peaks Tom bagged on the Bob Graham Round"],
  ["BEATLES", "Flora's favourite band"],
  ["TEDDINGTON", "The London town where Tom grew up"],
  ["HAMPTON", "Tom's old school"],
  ["AMOS", "The brother making the wedding dress"],
  ["CORNWALL", "Their spring pilgrimage, every year without fail"],
  ["TORPOR", "A state of sluggish inactivity"],
  ["MYRTLE", "Flora's middle name — or an evergreen shrub"],
  ["PUNCKNOWLE", "The Dorset village where Flora grew up — good luck spelling it"],
  ["HOLLYBUSHCRACK", "Tom's favourite route at Stanage"],
]

class CrosswordGrid
  attr_accessor :cells, :placements, :word_cells

  def initialize
    @cells = {}
    @placements = []
    @word_cells = {}
  end

  def deep_copy
    g = CrosswordGrid.new
    g.cells = @cells.dup
    g.placements = @placements.map(&:dup)
    g.word_cells = {}
    @word_cells.each { |w, s| g.word_cells[w] = s.dup }
    g
  end

  def bounds
    return [0, 0, 0, 0] if @cells.empty?
    rows = @cells.keys.map { |r, _| r }
    cols = @cells.keys.map { |_, c| c }
    [rows.min, rows.max, cols.min, cols.max]
  end

  def grid_area
    return 0 if @cells.empty?
    min_r, max_r, min_c, max_c = bounds
    (max_r - min_r + 1) * (max_c - min_c + 1)
  end

  def dimensions
    return [0, 0] if @cells.empty?
    min_r, max_r, min_c, max_c = bounds
    [max_r - min_r + 1, max_c - min_c + 1]
  end

  def can_place?(word, row, col, direction)
    dr = direction == 'across' ? 0 : 1
    dc = direction == 'across' ? 1 : 0
    length = word.length
    intersections = 0

    length.times do |i|
      r = row + i * dr
      c = col + i * dc
      letter = word[i]

      if @cells.key?([r, c])
        return [false, 0] if @cells[[r, c]] != letter
        intersections += 1
      else
        if direction == 'across'
          [-1, 1].each do |adj_dr|
            adj_r = r + adj_dr
            if @cells.key?([adj_r, c])
              is_crossing = @placements.any? do |pw, pr, pc, pd|
                pd == 'down' && pc == c && pr <= r && r <= pr + pw.length - 1
              end
              return [false, 0] unless is_crossing
            end
          end
        else
          [-1, 1].each do |adj_dc|
            adj_c = c + adj_dc
            if @cells.key?([r, adj_c])
              is_crossing = @placements.any? do |pw, pr, pc, pd|
                pd == 'across' && pr == r && pc <= c && c <= pc + pw.length - 1
              end
              return [false, 0] unless is_crossing
            end
          end
        end
      end
    end

    before_r = row - dr
    before_c = col - dc
    return [false, 0] if @cells.key?([before_r, before_c])

    after_r = row + length * dr
    after_c = col + length * dc
    return [false, 0] if @cells.key?([after_r, after_c])

    return [false, 0] if @placements.length > 0 && intersections == 0

    [true, intersections]
  end

  def place!(word, row, col, direction)
    dr = direction == 'across' ? 0 : 1
    dc = direction == 'across' ? 1 : 0
    @word_cells[word] = []
    word.length.times do |i|
      r = row + i * dr
      c = col + i * dc
      @cells[[r, c]] = word[i]
      @word_cells[word] << [r, c]
    end
    @placements << [word, row, col, direction]
  end

  def display
    return "Empty grid" if @cells.empty?
    min_r, max_r, min_c, max_c = bounds
    lines = []
    (min_r..max_r).each do |r|
      line = ""
      (min_c..max_c).each do |c|
        line += @cells.key?([r, c]) ? @cells[[r, c]] : "."
      end
      lines << line
    end
    lines.join("\n")
  end
end

def find_intersections(w1, w2)
  result = []
  w1.chars.each_with_index do |c1, i|
    w2.chars.each_with_index do |c2, j|
      result << [i, j, c1] if c1 == c2
    end
  end
  result
end

def find_all_placements(grid, word, intersections, placed_words)
  placements = []
  placed_words.each do |pw|
    ints = intersections[[word, pw]] || []
    ints.each do |wi, pi, _letter|
      grid.placements.each do |placed_word, pr, pc, pd|
        next unless placed_word == pw
        if pd == 'across'
          new_row = pr - wi
          new_col = pc + pi
          new_dir = 'down'
        else
          new_row = pr + pi
          new_col = pc - wi
          new_dir = 'across'
        end
        can, num_ints = grid.can_place?(word, new_row, new_col, new_dir)
        if can
          test_grid = grid.deep_copy
          test_grid.place!(word, new_row, new_col, new_dir)
          area = test_grid.grid_area
          h, w = test_grid.dimensions
          # Penalize non-square grids
          squareness = (h - w).abs
          placements << [num_ints, -area, -squareness, new_row, new_col, new_dir]
        end
      end
    end
  end
  placements
end

def try_build_grid(words, seed, strategy = :default)
  rng = Random.new(seed)

  intersections = {}
  words.each_with_index do |w1, i|
    words.each_with_index do |w2, j|
      intersections[[w1, w2]] = find_intersections(w1, w2) if i != j
    end
  end

  sorted_words = words.sort_by { |w| -w.length }

  case strategy
  when :longest_across
    start_word = sorted_words[0]
    start_dir = 'across'
  when :longest_down
    start_word = sorted_words[0]
    start_dir = 'down'
  when :second_longest
    start_word = sorted_words[[1, sorted_words.length - 1].min]
    start_dir = seed % 2 == 0 ? 'across' : 'down'
  when :random_start
    start_word = words[seed % words.length]
    start_dir = seed % 2 == 0 ? 'across' : 'down'
  else
    start_idx = seed % [sorted_words.length, 8].min
    start_word = sorted_words[start_idx]
    start_dir = seed % 2 == 0 ? 'across' : 'down'
  end

  grid = CrosswordGrid.new
  grid.place!(start_word, 0, 0, start_dir)

  placed = { start_word => true }
  remaining = words.reject { |w| w == start_word }
  remaining = remaining.sort_by { rng.rand }

  8.times do
    break if remaining.empty?
    placed_any = false

    scored = remaining.map do |word|
      score = 0
      placed.keys.each do |pw|
        ints = intersections[[word, pw]] || []
        score += ints.length
      end
      [score, word]
    end
    scored.sort_by! { |s, _w| -s }

    # Add randomness: sometimes shuffle top candidates
    if rng.rand < 0.3 && scored.length > 3
      top = scored[0..([scored.length - 1, 5].min)]
      top.shuffle!(random: rng)
      scored[0..top.length - 1] = top
    end

    words_placed = []
    scored.each do |_score, word|
      next if placed[word]
      all_p = find_all_placements(grid, word, intersections, placed.keys)
      next if all_p.empty?

      # Sort by: more intersections, smaller area, more square
      all_p.sort! { |a, b| b[0..2] <=> a[0..2] }

      # Sometimes pick a random good placement instead of the absolute best
      if rng.rand < 0.2 && all_p.length > 1
        idx = rng.rand([all_p.length, 3].min)
        chosen = all_p[idx]
      else
        chosen = all_p[0]
      end

      row, col, direction = chosen[3], chosen[4], chosen[5]
      grid.place!(word, row, col, direction)
      placed[word] = true
      words_placed << word
      placed_any = true
    end

    words_placed.each { |w| remaining.delete(w) }
    break unless placed_any
  end

  grid
end

def verify_connectivity(grid)
  return true if grid.placements.length <= 1
  word_names = grid.placements.map { |w, _r, _c, _d| w }
  adj = Hash.new { |h, k| h[k] = [] }
  (0...grid.placements.length).each do |i|
    ((i + 1)...grid.placements.length).each do |j|
      w1 = grid.placements[i][0]
      w2 = grid.placements[j][0]
      c1 = grid.word_cells[w1] || []
      c2 = grid.word_cells[w2] || []
      unless (c1 & c2).empty?
        adj[w1] << w2
        adj[w2] << w1
      end
    end
  end
  visited = { word_names[0] => true }
  queue = [word_names[0]]
  while !queue.empty?
    current = queue.shift
    adj[current].each do |neighbor|
      unless visited[neighbor]
        visited[neighbor] = true
        queue << neighbor
      end
    end
  end
  visited.length == word_names.length
end

def normalize_grid(grid)
  return grid if grid.cells.empty?
  min_r, _, min_c, _ = grid.bounds
  new_grid = CrosswordGrid.new
  grid.cells.each { |(r, c), l| new_grid.cells[[r - min_r, c - min_c]] = l }
  grid.placements.each { |w, r, c, d| new_grid.placements << [w, r - min_r, c - min_c, d] }
  grid.word_cells.each { |w, cells| new_grid.word_cells[w] = cells.map { |r, c| [r - min_r, c - min_c] } }
  new_grid
end

def assign_numbers(grid)
  min_r, max_r, min_c, max_c = grid.bounds
  starts = {}
  grid.placements.each { |_, row, col, _| starts[[row, col]] ||= true }
  number = 1
  cell_numbers = {}
  (min_r..max_r).each do |r|
    (min_c..max_c).each do |c|
      if starts.key?([r, c])
        cell_numbers[[r, c]] = number
        number += 1
      end
    end
  end
  cell_numbers
end

# Main
words = WORDS_AND_CLUES.map { |w, _| w }
clues = Hash[WORDS_AND_CLUES]

best_grid = nil
best_area = Float::INFINITY
strategies = [:longest_across, :longest_down, :second_longest, :random_start, :default]

total_attempts = 0
1000.times do |attempt|
  strategies.each do |strat|
    total_attempts += 1
    grid = try_build_grid(words, attempt * 7 + strategies.index(strat), strat)
    count = grid.placements.length
    connected = verify_connectivity(grid)

    if count == words.length && connected
      area = grid.grid_area
      dims = grid.dimensions
      if area < best_area
        best_area = area
        best_grid = grid.deep_copy
        $stderr.puts "#{total_attempts}: NEW BEST #{dims[0]}x#{dims[1]} = #{area}"
      end
    end
  end
end

if best_grid
  grid = normalize_grid(best_grid)
  cell_numbers = assign_numbers(grid)
  min_r, max_r, min_c, max_c = grid.bounds
  grid_width = max_c - min_c + 1
  grid_height = max_r - min_r + 1

  words_json = grid.placements.map do |word, row, col, direction|
    num = cell_numbers[[row, col]] || 0
    { "word" => word, "clue" => clues[word], "row" => row, "col" => col, "direction" => direction, "number" => num }
  end
  words_json.sort_by! { |w| w["number"] }

  result = { "gridWidth" => grid_width, "gridHeight" => grid_height, "words" => words_json }

  $stderr.puts "\n#{"=" * 60}"
  $stderr.puts "BEST: #{grid.placements.length}/#{words.length} words, #{grid_height}x#{grid_width} = #{best_area}"
  $stderr.puts "Connected: #{verify_connectivity(grid)}"
  $stderr.puts "#{"=" * 60}\n"
  $stderr.puts "GRID:"
  $stderr.puts grid.display
  $stderr.puts
  $stderr.puts "PLACEMENTS:"
  words_json.each { |w| $stderr.puts "  #{w['number'].to_s.rjust(2)}. #{w['word'].ljust(16)} #{w['direction'].ljust(7)} (#{w['row']},#{w['col']})" }

  placed_words = grid.placements.map { |w, _, _, _| w }.sort
  missing = words.sort - placed_words
  $stderr.puts "\n  MISSING: #{missing.join(', ')}" unless missing.empty?

  puts JSON.pretty_generate(result)
else
  $stderr.puts "No complete grid found!"
end
