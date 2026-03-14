#!/usr/bin/env ruby
# Generate a valid medium-difficulty sudoku puzzle

class SudokuGenerator
  def initialize
    @grid = Array.new(9) { Array.new(9, 0) }
  end

  def generate
    fill_grid(0, 0)
    solution = @grid.map(&:dup)

    # Remove cells to create puzzle (medium = ~35-40 givens)
    cells = (0..80).to_a.shuffle
    removed = 0
    target_empty = 46  # 81 - 35 = 46 empty for medium

    cells.each do |idx|
      break if removed >= target_empty
      r, c = idx / 9, idx % 9
      backup = @grid[r][c]
      @grid[r][c] = 0

      # Check unique solution
      if count_solutions(0) == 1
        removed += 1
      else
        @grid[r][c] = backup
      end
    end

    { puzzle: @grid.map(&:dup), solution: solution, givens: 81 - removed }
  end

  private

  def valid?(r, c, num)
    return false if @grid[r].include?(num)
    return false if (0..8).any? { |i| @grid[i][c] == num }
    br, bc = (r/3)*3, (c/3)*3
    (br..br+2).each { |i| (bc..bc+2).each { |j| return false if @grid[i][j] == num } }
    true
  end

  def fill_grid(r, c)
    return true if r == 9
    nr, nc = c == 8 ? [r+1, 0] : [r, c+1]
    (1..9).to_a.shuffle.each do |num|
      if valid?(r, c, num)
        @grid[r][c] = num
        return true if fill_grid(nr, nc)
        @grid[r][c] = 0
      end
    end
    false
  end

  def count_solutions(limit = 2)
    # Find first empty cell
    empty = nil
    9.times { |r| 9.times { |c| empty = [r, c] if @grid[r][c] == 0 && empty.nil? } }
    return 1 unless empty

    r, c = empty
    count = 0
    (1..9).each do |num|
      if valid?(r, c, num)
        @grid[r][c] = num
        count += count_solutions(limit)
        @grid[r][c] = 0
        return count if count >= 2  # Early exit, not unique
      end
    end
    count
  end
end

gen = SudokuGenerator.new
result = gen.generate

puts "Givens: #{result[:givens]}"
puts ""
puts "Puzzle:"
puts "["
result[:puzzle].each_with_index do |row, i|
  puts "  [#{row.join(',')}]#{i < 8 ? ',' : ''}"
end
puts "]"
puts ""
puts "Solution:"
puts "["
result[:solution].each_with_index do |row, i|
  puts "  [#{row.join(',')}]#{i < 8 ? ',' : ''}"
end
puts "]"
