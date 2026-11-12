import numpy as np

from fieldmap import compare


def test_jaccard_is_shared_over_either():
    a = np.array([True, True, False])
    b = np.array([True, False, True])
    assert compare.jaccard(a, b) == 1 / 3


def test_relabelled_groups_are_all_found_again():
    assert compare.recovered(np.array([0, 0, 1]), np.array([1, 1, 0])) == 1


def test_a_split_group_is_not_found_again():
    first, other = np.zeros(6, int), np.array([0, 0, 1, 1, 2, 2])
    assert compare.recovered(first, other) == 0


def test_a_group_recurs_once_per_rerun_that_finds_it():
    group = np.array([True, True, False, False])
    reruns = [
        compare.groups(np.array([0, 0, 1, 1])),
        compare.groups(np.array([0, 1, 0, 1])),
    ]
    assert compare.recurs(group, reruns) == 1
