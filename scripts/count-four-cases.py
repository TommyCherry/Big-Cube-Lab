"""Exact Burnside counts for four 2x2 centers, four stickers per color.

Rotations are pattern equivalences, not claims of equal optimal solution cost.
Requires only Python's standard library.
"""
from collections import Counter
from functools import lru_cache
from itertools import permutations, product
from math import factorial
import json


def cycles(p):
    unseen = set(range(len(p)))
    sizes = []
    while unseen:
        i = next(iter(unseen))
        size = 0
        while i in unseen:
            unseen.remove(i)
            size += 1
            i = p[i]
        sizes.append(size)
    return tuple(sorted(sizes, reverse=True))


@lru_cache(None)
def fixed_colorings(position_cycles, color_permutation):
    options = {}
    for length in set(position_cycles):
        choices = Counter()
        for first in range(4):
            counts = [0] * 4
            color = first
            for _ in range(length):
                counts[color] += 1
                color = color_permutation[color]
            if color == first and max(counts) <= 4:
                choices[tuple(counts)] += 1
        options[length] = choices

    @lru_cache(None)
    def count(index, remaining):
        if index == len(position_cycles):
            return int(remaining == (0, 0, 0, 0))
        result = 0
        for usage, multiplicity in options[position_cycles[index]].items():
            rest = tuple(a - b for a, b in zip(remaining, usage))
            if min(rest) >= 0:
                result += multiplicity * count(index + 1, rest)
        return result

    return count(0, (4, 4, 4, 4))


COLORS = list(permutations(range(4)))
IDENTITY = (0, 1, 2, 3)


def orbit_count(face_permutations, rotations, relabel=True):
    # Local slots are in cyclic order; every face rotation shifts by 0..3.
    types = Counter()
    for faces in face_permutations:
        for turns in rotations:
            p = tuple(4 * faces[face] + (slot + turns[face]) % 4
                      for face in range(4) for slot in range(4))
            types[cycles(p)] += 1
    color_group = COLORS if relabel else [IDENTITY]
    numerator = sum(multiplicity * fixed_colorings(kind, color)
                    for kind, multiplicity in types.items() for color in color_group)
    denominator = sum(types.values()) * len(color_group)
    assert numerator % denominator == 0
    return numerator // denominator


def main():
    no_rotation = [(0, 0, 0, 0)]
    top_rotation = [(i, 0, 0, 0) for i in range(4)]
    all_rotations = list(product(range(4), repeat=4))
    # Faces here are in cyclic belt order; D4 preserves adjacency/opposition.
    belt_symmetries = [tuple((sign * i + offset) % 4 for i in range(4))
                      for sign in (1, -1) for offset in range(4)]
    result = {
        'labeled_states': factorial(16) // factorial(4) ** 4,
        'global_color_relabeling': orbit_count([IDENTITY], no_rotation),
        'global_color_relabeling_and_U_rotation': orbit_count([IDENTITY], top_rotation),
        'global_color_relabeling_and_independent_center_rotations': orbit_count([IDENTITY], all_rotations),
        'also_belt_dihedral_symmetry': orbit_count(belt_symmetries, all_rotations),
        'also_arbitrary_face_permutation': orbit_count(list(permutations(range(4))), all_rotations),
    }
    assert result['global_color_relabeling'] * 24 == result['labeled_states']
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
