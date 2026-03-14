#!/usr/bin/env python3
"""
Crossword puzzle generator that places 20 words into a compact connected grid.
Uses a greedy search with backtracking to find optimal placements.
"""

import json
import random
import copy
import sys
from collections import defaultdict

WORDS_AND_CLUES = [
    ("PARIS", "The city where they got engaged"),
    ("DORIS", "The naughty border collie who ate the simnel cake"),
    ("SHEFFIELD", "The city these two call home"),
    ("MARCH", "The month it all began, 2021"),
    ("OCTOBER", "The month of the wedding"),
    ("TOMMIT", "What Inigo calls the groom"),
    ("CLIMBING", "Flora and Tom's shared passion — no ropes needed if you're bouldering"),
    ("MAMTOR", "The Peak District hill where it all started with a kiss"),
    ("SCOTT", "Tom's middle name"),
    ("AMODO", "Tom's design company"),
    ("FORTYTWO", "Peaks Tom bagged on the Bob Graham Round"),
    ("BEATLES", "Flora's favourite band"),
    ("TEDDINGTON", "The London town where Tom grew up"),
    ("HAMPTON", "Tom's old school"),
    ("AMOS", "The brother making the wedding dress"),
    ("CORNWALL", "Their spring pilgrimage, every year without fail"),
    ("TORPOR", "A state of sluggish inactivity"),
    ("MYRTLE", "Flora's middle name — or an evergreen shrub"),
    ("PUNCKNOWLE", "The Dorset village where Flora grew up — good luck spelling it"),
    ("HOLLYBUSHCRACK", "Tom's favourite route at Stanage"),
]

class CrosswordGrid:
    def __init__(self):
        self.cells = {}  # (row, col) -> letter
        self.placements = []  # list of (word, row, col, direction)
        self.word_cells = {}  # word -> set of (row, col)

    def copy(self):
        g = CrosswordGrid()
        g.cells = dict(self.cells)
        g.placements = list(self.placements)
        g.word_cells = {w: set(s) for w, s in self.word_cells.items()}
        return g

    def get_bounds(self):
        if not self.cells:
            return 0, 0, 0, 0
        rows = [r for r, c in self.cells]
        cols = [c for r, c in self.cells]
        return min(rows), max(rows), min(cols), max(cols)

    def grid_size(self):
        if not self.cells:
            return 0
        min_r, max_r, min_c, max_c = self.get_bounds()
        return (max_r - min_r + 1) * (max_c - min_c + 1)

    def grid_dimensions(self):
        if not self.cells:
            return 0, 0
        min_r, max_r, min_c, max_c = self.get_bounds()
        return max_r - min_r + 1, max_c - min_c + 1

    def can_place(self, word, row, col, direction):
        """Check if a word can be placed at (row, col) in the given direction."""
        dr, dc = (0, 1) if direction == 'across' else (1, 0)
        length = len(word)
        intersections = 0
        cells_used = []

        for i, letter in enumerate(word):
            r = row + i * dr
            c = col + i * dc
            cells_used.append((r, c))

            if (r, c) in self.cells:
                if self.cells[(r, c)] != letter:
                    return False, 0
                intersections += 1
            else:
                # Check for parallel adjacency (no side-by-side parallel words)
                if direction == 'across':
                    # Check cells above and below
                    for adj_r in [r - 1, r + 1]:
                        if (adj_r, c) in self.cells:
                            # This adjacent cell has a letter - check if it's from a
                            # crossing word (perpendicular) at this exact column
                            # It's okay if it's part of a word crossing through (r, c)
                            # but not okay if it's just running parallel
                            is_crossing = False
                            for pw, pr, pc, pd in self.placements:
                                if pd == 'down':
                                    if pc == c:
                                        start_r = pr
                                        end_r = pr + len(pw) - 1
                                        if start_r <= r <= end_r:
                                            is_crossing = True
                                            break
                            if not is_crossing:
                                return False, 0
                else:  # down
                    for adj_c in [c - 1, c + 1]:
                        if (r, adj_c) in self.cells:
                            is_crossing = False
                            for pw, pr, pc, pd in self.placements:
                                if pd == 'across':
                                    if pr == r:
                                        start_c = pc
                                        end_c = pc + len(pw) - 1
                                        if start_c <= c <= end_c:
                                            is_crossing = True
                                            break
                            if not is_crossing:
                                return False, 0

        # Check cell before start of word is empty
        before_r = row - dr
        before_c = col - dc
        if (before_r, before_c) in self.cells:
            return False, 0

        # Check cell after end of word is empty
        after_r = row + (length) * dr
        after_c = col + (length) * dc
        if (after_r, after_c) in self.cells:
            return False, 0

        # Must have at least one intersection (unless it's the first word)
        if len(self.placements) > 0 and intersections == 0:
            return False, 0

        return True, intersections

    def place(self, word, row, col, direction):
        dr, dc = (0, 1) if direction == 'across' else (1, 0)
        self.word_cells[word] = set()
        for i, letter in enumerate(word):
            r = row + i * dr
            c = col + i * dc
            self.cells[(r, c)] = letter
            self.word_cells[word].add((r, c))
        self.placements.append((word, row, col, direction))

    def display(self):
        if not self.cells:
            print("Empty grid")
            return
        min_r, max_r, min_c, max_c = self.get_bounds()
        lines = []
        for r in range(min_r, max_r + 1):
            line = ""
            for c in range(min_c, max_c + 1):
                if (r, c) in self.cells:
                    line += self.cells[(r, c)]
                else:
                    line += "."
            lines.append(line)
        return "\n".join(lines)


def find_intersections(word1, word2):
    """Find all possible intersection points between two words."""
    result = []
    for i, c1 in enumerate(word1):
        for j, c2 in enumerate(word2):
            if c1 == c2:
                result.append((i, j, c1))
    return result


def build_letter_index(words):
    """Build index of which words contain which letters at which positions."""
    index = defaultdict(list)
    for word in words:
        for i, letter in enumerate(word):
            index[letter].append((word, i))
    return index


def solve_crossword(words_and_clues, max_attempts=50):
    words = [w for w, c in words_and_clues]
    clues = {w: c for w, c in words_and_clues}

    best_grid = None
    best_size = float('inf')

    for attempt in range(max_attempts):
        grid = try_build_grid(words, attempt)
        if grid and len(grid.placements) == len(words):
            size = grid.grid_size()
            dims = grid.grid_dimensions()
            print(f"Attempt {attempt + 1}: All {len(words)} words placed! Grid size: {dims[0]}x{dims[1]} = {size}")
            if size < best_size:
                best_size = size
                best_grid = grid.copy()
        elif grid:
            print(f"Attempt {attempt + 1}: Only {len(grid.placements)}/{len(words)} words placed")

    return best_grid, clues


def try_build_grid(words, seed):
    random.seed(seed * 17 + 42)

    # Pre-compute intersection possibilities between all word pairs
    intersections = {}
    for i, w1 in enumerate(words):
        for j, w2 in enumerate(words):
            if i != j:
                intersections[(w1, w2)] = find_intersections(w1, w2)

    # Start with the longest word
    sorted_words = sorted(words, key=len, reverse=True)

    # Try different starting words and orderings
    if seed < len(sorted_words):
        start_word = sorted_words[seed % len(sorted_words)]
    else:
        start_word = random.choice(sorted_words[:5])

    grid = CrosswordGrid()
    # Place first word
    if seed % 2 == 0:
        grid.place(start_word, 0, 0, 'across')
    else:
        grid.place(start_word, 0, 0, 'down')

    placed = {start_word}
    remaining = [w for w in words if w != start_word]
    random.shuffle(remaining)

    # Sort remaining by number of possible intersections with placed words (descending)
    # Re-sort after each placement
    fail_count = 0
    max_fails = 3  # Number of times we allow failing to place any word before giving up

    while remaining and fail_count < max_fails:
        placed_any = False

        # Score remaining words by how many intersections they have with placed words
        scored = []
        for word in remaining:
            max_ints = 0
            for pw in placed:
                ints = intersections.get((word, pw), [])
                max_ints += len(ints)
            scored.append((max_ints, word))

        scored.sort(reverse=True)
        # Add some randomness
        if seed > 10:
            random.shuffle(scored)

        for _, word in scored:
            best_placement = find_best_placement(grid, word, intersections, placed)
            if best_placement:
                row, col, direction = best_placement
                grid.place(word, row, col, direction)
                placed.add(word)
                remaining.remove(word)
                placed_any = True
                break

        if not placed_any:
            # Try harder - try all remaining words with all possible placements
            found = False
            for _, word in scored:
                all_placements = find_all_placements(grid, word, intersections, placed)
                if all_placements:
                    # Pick a random valid placement
                    row, col, direction = random.choice(all_placements)
                    grid.place(word, row, col, direction)
                    placed.add(word)
                    remaining.remove(word)
                    found = True
                    break
            if not found:
                fail_count += 1

    return grid


def find_best_placement(grid, word, intersections, placed_words):
    """Find the best placement for a word that intersects with existing words."""
    candidates = []

    for pw in placed_words:
        ints = intersections.get((word, pw), [])
        for wi, pi, letter in ints:
            # Find where pw is placed
            for placed_word, pr, pc, pd in grid.placements:
                if placed_word == pw:
                    if pd == 'across':
                        # pw goes across, so new word goes down
                        cross_r = pr
                        cross_c = pc + pi
                        new_row = cross_r - wi
                        new_col = cross_c
                        new_dir = 'down'
                    else:
                        # pw goes down, so new word goes across
                        cross_r = pr + pi
                        cross_c = pc
                        new_row = cross_r
                        new_col = cross_c - wi
                        new_dir = 'across'

                    can, num_ints = grid.can_place(word, new_row, new_col, new_dir)
                    if can:
                        # Score: prefer more intersections and more compact grid
                        test_grid = grid.copy()
                        test_grid.place(word, new_row, new_col, new_dir)
                        size = test_grid.grid_size()
                        candidates.append((num_ints, -size, new_row, new_col, new_dir))

    if candidates:
        candidates.sort(reverse=True)
        _, _, row, col, direction = candidates[0]
        return row, col, direction
    return None


def find_all_placements(grid, word, intersections, placed_words):
    """Find all valid placements for a word."""
    placements = []

    for pw in placed_words:
        ints = intersections.get((word, pw), [])
        for wi, pi, letter in ints:
            for placed_word, pr, pc, pd in grid.placements:
                if placed_word == pw:
                    if pd == 'across':
                        cross_r = pr
                        cross_c = pc + pi
                        new_row = cross_r - wi
                        new_col = cross_c
                        new_dir = 'down'
                    else:
                        cross_r = pr + pi
                        cross_c = pc
                        new_row = cross_r
                        new_col = cross_c - wi
                        new_dir = 'across'

                    can, num_ints = grid.can_place(word, new_row, new_col, new_dir)
                    if can:
                        placements.append((new_row, new_col, new_dir))

    return placements


def normalize_grid(grid):
    """Shift grid so top-left is (0, 0)."""
    if not grid.cells:
        return grid
    min_r, max_r, min_c, max_c = grid.get_bounds()
    new_grid = CrosswordGrid()
    for (r, c), letter in grid.cells.items():
        new_grid.cells[(r - min_r, c - min_c)] = letter
    for word, row, col, direction in grid.placements:
        new_grid.placements.append((word, row - min_r, col - min_c, direction))
    for word, cells in grid.word_cells.items():
        new_grid.word_cells[word] = {(r - min_r, c - min_c) for r, c in cells}
    return new_grid


def assign_numbers(grid):
    """Assign standard crossword numbers to cells."""
    min_r, max_r, min_c, max_c = grid.get_bounds()

    # Find which cells start across or down words
    starts = {}  # (row, col) -> set of directions
    for word, row, col, direction in grid.placements:
        if (row, col) not in starts:
            starts[(row, col)] = set()
        starts[(row, col)].add(direction)

    # Number cells left-to-right, top-to-bottom
    number = 1
    cell_numbers = {}
    for r in range(min_r, max_r + 1):
        for c in range(min_c, max_c + 1):
            if (r, c) in starts:
                cell_numbers[(r, c)] = number
                number += 1

    return cell_numbers


def generate_output(grid, clues):
    grid = normalize_grid(grid)
    cell_numbers = assign_numbers(grid)

    min_r, max_r, min_c, max_c = grid.get_bounds()
    grid_width = max_c - min_c + 1
    grid_height = max_r - min_r + 1

    # Build JSON structure
    words_json = []
    for word, row, col, direction in grid.placements:
        num = cell_numbers.get((row, col), 0)
        words_json.append({
            "word": word,
            "clue": clues[word],
            "row": row,
            "col": col,
            "direction": direction,
            "number": num
        })

    # Sort by number
    words_json.sort(key=lambda x: x["number"])

    result = {
        "gridWidth": grid_width,
        "gridHeight": grid_height,
        "words": words_json
    }

    return grid, result


def verify_connectivity(grid):
    """Verify all words are connected via shared letters."""
    if len(grid.placements) <= 1:
        return True

    # Build adjacency: two words are connected if they share a cell
    word_names = [w for w, r, c, d in grid.placements]
    adj = defaultdict(set)
    for i, (w1, r1, c1, d1) in enumerate(grid.placements):
        for j, (w2, r2, c2, d2) in enumerate(grid.placements):
            if i < j:
                cells1 = grid.word_cells.get(w1, set())
                cells2 = grid.word_cells.get(w2, set())
                if cells1 & cells2:
                    adj[w1].add(w2)
                    adj[w2].add(w1)

    # BFS from first word
    visited = {word_names[0]}
    queue = [word_names[0]]
    while queue:
        current = queue.pop(0)
        for neighbor in adj[current]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    return len(visited) == len(word_names)


if __name__ == "__main__":
    print("=" * 60)
    print("CROSSWORD PUZZLE GENERATOR")
    print("=" * 60)
    print(f"\nAttempting to place {len(WORDS_AND_CLUES)} words...")
    print()

    best_grid, clues = solve_crossword(WORDS_AND_CLUES, max_attempts=100)

    if best_grid:
        grid, json_data = generate_output(best_grid, clues)

        connected = verify_connectivity(grid)
        print(f"\n{'=' * 60}")
        print(f"BEST RESULT: {len(grid.placements)}/{len(WORDS_AND_CLUES)} words placed")
        print(f"All words connected: {connected}")
        dims = grid.grid_dimensions()
        print(f"Grid dimensions: {dims[0]} x {dims[1]}")
        print(f"{'=' * 60}\n")

        print("GRID:")
        print(grid.display())
        print()

        print("JSON DATA:")
        print(json.dumps(json_data, indent=2))

        # Print word list
        print("\n\nWORD PLACEMENT SUMMARY:")
        print("-" * 60)
        for wp in json_data["words"]:
            print(f"  {wp['number']:2d}. {wp['word']:<16s} {wp['direction']:<7s} at row={wp['row']}, col={wp['col']}")

        # Check which words are missing
        placed_words = {w for w, r, c, d in grid.placements}
        all_words = {w for w, c in WORDS_AND_CLUES}
        missing = all_words - placed_words
        if missing:
            print(f"\n  MISSING WORDS: {', '.join(sorted(missing))}")
    else:
        print("Failed to build any grid!")
