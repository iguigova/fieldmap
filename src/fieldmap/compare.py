"""Comparing two clusterings of the same papers, group by group."""

import numpy as np

# A group is found again in another run when one there shares this Jaccard.
MATCH = 0.5


def groups(labels: np.ndarray) -> list[np.ndarray]:
    return [labels == c for c in np.unique(labels)]


def jaccard(a: np.ndarray, b: np.ndarray) -> float:
    return float((a & b).sum() / (a | b).sum())


def found_again(group: np.ndarray, others: list[np.ndarray]) -> bool:
    return max(jaccard(group, o) for o in others) >= MATCH


def recovered(first: np.ndarray, other: np.ndarray) -> float:
    others = groups(other)
    return float(np.mean([found_again(g, others) for g in groups(first)]))


def recurs(group: np.ndarray, reruns: list[list[np.ndarray]]) -> int:
    return sum(found_again(group, others) for others in reruns)
