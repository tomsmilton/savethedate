#!/usr/bin/env ruby
# Crossword puzzle generator - places 20 words into a compact connected grid
# Uses greedy search with multiple random attempts

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
    @cells = {}       # [row, col] => letter
    @placements = []  # [[word, row, col, direction], ...]
    @word_cells = {}  # word => Set of [row, col]
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
    rows = @cells.keys.map { |r, c| r }
    cols = @cells.keys.map { |r, c| c }
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
        # Check for parallel adjacency
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

    # Check cell before start is empty
    before_r = row - dr
    before_c = col - dc
    return [false, 0] if @cells.key?([before_r, before_c])

    # Check cell after end is empty
    after_r = row + length * dr
    after_c = col + length * dc
    return [false, 0] if @cells.key?([after_r, after_c])

    # Must intersect if not the first word
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

def try_build_grid(words, seed)
  rng = Random.new(seed * 17 + 42)

  # Pre-compute intersections
  intersections = {}
  words.each_with_index do |w1, i|
    words.each_with_index do |w2, j|
      intersections[[w1, w2]] = find_intersections(w1, w2) if i != j
    end
  end

  sorted_words = words.sort_by { |w| -w.length }

  start_idx = seed % [sorted_words.length, 5].min
  start_word = sorted_words[start_idx]

  grid = CrosswordGrid.new
  start_dir = seed % 2 == 0 ? 'across' : 'down'
  grid.place!(start_word, 0, 0, start_dir)

  placed = { start_word => true }
  remaining = words.reject { |w| w == start_word }

  # Shuffle remaining with seeded RNG
  remaining = remaining.sort_by { rng.rand }

  max_rounds = 5

  max_rounds.times do
    break if remaining.empty?
    placed_any_this_round = false

    # Score remaining words by intersection potential
    scored = remaining.map do |word|
      score = 0
      placed.keys.each do |pw|
        ints = intersections[[word, pw]] || []
        score += ints.length
      end
      [score, word]
    end
    scored.sort_by! { |s, w| -s }

    # Try to place each word
    words_placed_this_iteration = []
    scored.each do |_score, word|
      next if placed[word]
      best = find_best_placement(grid, word, intersections, placed.keys)
      if best
        row, col, direction = best
        grid.place!(word, row, col, direction)
        placed[word] = true
        words_placed_this_iteration << word
        placed_any_this_round = true
      end
    end

    words_placed_this_iteration.each { |w| remaining.delete(w) }
    break unless placed_any_this_round
  end

  grid
end

def find_best_placement(grid, word, intersections, placed_words)
  candidates = []

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
          candidates << [num_ints, -area, new_row, new_col, new_dir]
        end
      end
    end
  end

  return nil if candidates.empty?
  candidates.sort! { |a, b| b[0..1] <=> a[0..1] }
  [candidates[0][2], candidates[0][3], candidates[0][4]]
end

def normalize_grid(grid)
  return grid if grid.cells.empty?
  min_r, _max_r, min_c, _max_c = grid.bounds

  new_grid = CrosswordGrid.new
  grid.cells.each do |(r, c), letter|
    new_grid.cells[[r - min_r, c - min_c]] = letter
  end
  grid.placements.each do |word, row, col, direction|
    new_grid.placements << [word, row - min_r, col - min_c, direction]
  end
  grid.word_cells.each do |word, cells|
    new_grid.word_cells[word] = cells.map { |r, c| [r - min_r, c - min_c] }
  end
  new_grid
end

def verify_connectivity(grid)
  return true if grid.placements.length <= 1

  word_names = grid.placements.map { |w, _r, _c, _d| w }
  adj = Hash.new { |h, k| h[k] = [] }

  (0...grid.placements.length).each do |i|
    ((i + 1)...grid.placements.length).each do |j|
      w1 = grid.placements[i][0]
      w2 = grid.placements[j][0]
      cells1 = grid.word_cells[w1] || []
      cells2 = grid.word_cells[w2] || []
      unless (cells1 & cells2).empty?
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

def assign_numbers(grid)
  min_r, max_r, min_c, max_c = grid.bounds

  starts = {}
  grid.placements.each do |word, row, col, direction|
    starts[[row, col]] ||= []
    starts[[row, col]] << direction
  end

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

# Main execution
$stderr.puts "=" * 60
$stderr.puts "CROSSWORD PUZZLE GENERATOR"
$stderr.puts "=" * 60
$stderr.puts "Attempting to place #{WORDS_AND_CLUES.length} words..."
$stderr.puts

words = WORDS_AND_CLUES.map { |w, _c| w }
clues = Hash[WORDS_AND_CLUES]

best_grid = nil
best_area = Float::INFINITY
best_count = 0

200.times do |attempt|
  grid = try_build_grid(words, attempt)
  count = grid.placements.length
  connected = verify_connectivity(grid)

  if count == words.length && connected
    area = grid.grid_area
    dims = grid.dimensions
    $stderr.puts "Attempt #{attempt + 1}: All #{count} words placed! #{dims[0]}x#{dims[1]} = #{area} #{connected ? '(connected)' : '(NOT connected)'}"
    if area < best_area
      best_area = area
      best_grid = grid.deep_copy
    end
  elsif count > best_count && !best_grid
    best_count = count
    $stderr.puts "Attempt #{attempt + 1}: #{count}/#{words.length} words placed"
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
    {
      "word" => word,
      "clue" => clues[word],
      "row" => row,
      "col" => col,
      "direction" => direction,
      "number" => num
    }
  end

  words_json.sort_by! { |w| w["number"] }

  result = {
    "gridWidth" => grid_width,
    "gridHeight" => grid_height,
    "words" => words_json
  }

  connected = verify_connectivity(grid)
  placed_words = grid.placements.map { |w, _r, _c, _d| w }.sort
  all_words = words.sort
  missing = all_words - placed_words

  $stderr.puts
  $stderr.puts "=" * 60
  $stderr.puts "BEST RESULT: #{grid.placements.length}/#{words.length} words placed"
  $stderr.puts "All words connected: #{connected}"
  $stderr.puts "Grid dimensions: #{grid_height} x #{grid_width}"
  $stderr.puts "=" * 60
  $stderr.puts
  $stderr.puts "GRID:"
  $stderr.puts grid.display
  $stderr.puts
  $stderr.puts "WORD PLACEMENT SUMMARY:"
  $stderr.puts "-" * 60
  words_json.each do |wp|
    $stderr.puts "  #{wp['number'].to_s.rjust(2)}. #{wp['word'].ljust(16)} #{wp['direction'].ljust(7)} at row=#{wp['row']}, col=#{wp['col']}"
  end

  unless missing.empty?
    $stderr.puts "\n  MISSING WORDS: #{missing.join(', ')}"
  end

  # Output JSON to stdout
  puts JSON.pretty_generate(result)
else
  $stderr.puts "Failed to build a complete grid!"
  $stderr.puts "Best attempt placed #{best_count}/#{words.length} words"
end
