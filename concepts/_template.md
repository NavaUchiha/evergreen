# Maximum Subarray — Divide & Conquer

> Find the contiguous subarray with the largest sum.
> D&C solution in O(n log n). (Kadane does it in O(n) — noted at the end — but the
> D&C version is the one that *teaches* the divide-classify-attack-the-seam pattern.)

---

## 1. Intuition & first-principles derivation

You don't reach for the crossing-scan trick. You reach for one reflex and then refuse to
hand-wave the case it leaves behind.

**The reflex:** you have brute force O(n²) and it feels wasteful — overlapping recomputation.
When you want sub-quadratic on an array, the default first move is *cut it in half and handle
the halves separately*. Not clever — a reflex, the same one that works for sorting and search.

**The make-or-break question:** you've drawn a line down the middle. Where can the answer be
*relative to that line*? Force yourself to be exhaustive:

- entirely in the **left** half, or
- entirely in the **right** half, or
- **crossing** the line.

There is no fourth option — a contiguous stretch either touches both sides of the cut or it
doesn't. That exhaustiveness is the whole foundation: the cut partitions **all possible answers**
into three clean buckets.

**Where the friction lives:** left-only and right-only are *the same problem on half the data* →
recursion eats them for free. But the crossing case is **not** a smaller copy of the problem —
so you can't recurse on it. That friction is exactly where the algorithm lives.

**Characterize the annoying case until it becomes easy.** "Crossing" means it touches both sides
of the line. If it's contiguous *and* touches both sides, it **must contain the two middle
elements** (`mid` and `mid+1`). It is **anchored** at the seam. And the instant you see "anchored,"
the difficulty inverts: an anchored subarray has almost no freedom — its only choice is *how far
out to reach on each side*. And "best reach from a fixed point" is a trivial linear scan.

**The independence insight (this is what keeps it O(n), not O(n²)):** the left reach and the right
reach don't affect each other — the total is just (left part) + (right part). So you don't
enumerate combinations. You find the **best left reach** and the **best right reach** separately,
each in one scan, and add the two winners once.

> **Anchored is the guy.** Every downstream fact — why it isn't recursive, why it's cheap, why the
> two sides are independent — falls out of "the crossing subarray is pinned at the seam."

---

## 2. Worked example

```
idx:   0    1    2    3 |  4    5    6    7
val:  -2   -5    6   -2 | -3    1    5   -6
                    mid=3   seam between idx3 and idx4
```

**Left half** (recurse) → best is `[6]` = **6**
**Right half** (recurse) → best is `[1,5]` = **6**

**Crossing — two independent scans from the seam, each keeps a running sum + best-so-far:**

Left scan (from idx3, walk left, *must* include idx3):
```
                         running   best
[-2]                       -2       -2
[6,-2]                      4        4   ← best-left
[-5,6,-2]                  -1        4
[-2,-5,6,-2]              -3        4
```
`left_best = 4`. Note idx2 = 6 made the running sum jump; walking further only hurt — but you
scan to the edge anyway, because a big positive could hide at the far end.

Right scan (from idx4, walk right, *must* include idx4):
```
                         running   best
[-3]                       -3       -3
[-3,1]                     -2       -2
[-3,1,5]                    3        3   ← best-right
[-3,1,5,-6]               -3        3
```
`right_best = 3`.

**Glue once:** `cross = left_best + right_best = 4 + 3 = 7` → subarray `[6,-2,-3,1,5]`.

**Winner** = `max(left=6, right=6, cross=7)` = **7**.

The crossing answer forced you to *keep* the bad `-2,-3` in the middle — you're not allowed to
skip, and that's exactly what made the crossing case the real work.

**Why adding the two winners is safe (no double-count, no gap):** the left scan starts *on* the
seam-left element and walks left; the right scan starts *on* the seam-right element and walks
right. They start on **different, adjacent** cells moving in **opposite** directions — so they
never share a cell (no double-count), and because the two seam cells are neighbors, gluing them
leaves no gap.

---

## 3. Approaches & trade-offs

| Approach | Idea | Time | Space | Notes |
|---|---|---|---|---|
| Brute force | try every (i, j) pair, sum each | O(n²) or O(n³) | O(1) | the "wasteful" baseline that triggers D&C |
| Divide & conquer | split, recurse both halves, solve crossing directly | **O(n log n)** | O(log n) stack | teaches the seam pattern |
| Kadane | carry "best subarray ending here" left→right | **O(n)** | O(1) | what you'd ship |

Kadane is the crossing idea *generalized* so you never split at all: "best ending here" is the
anchored-reach idea carried across the whole array in one pass. D&C is the better teaching
solution; Kadane is the better shipping solution.

---

## 4. Complexity — the level table

Per D&C call: two half-size recursions + an O(n) crossing scan. So:

```
T(n) = 2·T(n/2) + O(n)
```

Build the level table (n = 8):

| level | nodes | scan work each | level total |
|---|---|---|---|
| 0 | 1 | n | **n** |
| 1 | 2 | n/2 | **n** |
| 2 | 4 | n/4 | **n** |
| 3 | 8 | 1 | **n** |

Node count **doubles**, per-node work **halves** — they cancel, so **every level costs n**. This is
the *flat* case. Flat levels → total = (work per level) × (number of levels).

Number of levels = halvings of n down to 1 = **log n**.

```
total = n × log n = O(n log n)
```

Cross-check with the Master Theorem: `a=2, b=2, f(n)=n`. Leaves force `n^(log₂2)=n`, and
`f(n)=n` equals it → **Case 2 (tie)** → `Θ(n log n)`. Same answer; the "tie" case is just the
formal name for "flat levels, multiply by depth."

---

## 5. Interview framing

- **Deriving the D&C cold, never having seen it:** hard under pressure — the reflective
  "sit with the friction, characterize the anchored case" chain is tough to run live. Don't hold
  yourself to it.
- **What's actually expected:** for Maximum Subarray the target answer is usually **Kadane's
  O(n)**. The D&C is a "do you understand recursion / tradeoffs" flex, often reached with a nudge.
- **The one sentence that survives adrenaline:** *"Split it — where can the answer be relative to
  the split? Left, right, or crossing. Left/right recurse for free; the crossing subarray is
  anchored at the seam, so I find the best reach each way in a linear scan and add them."*
- **Strong close:** state Kadane as the shipping answer, mention the D&C alternative and its
  O(n log n), and note the two are connected (Kadane = the crossing idea with no split needed).

**Transferable pattern (the real reason this concept matters):**
1. Split the obvious way (reflex).
2. Exhaustively classify where the answer can be relative to the split (the discipline).
3. Cases matching the split → recurse for free.
4. The case that *spans* the split → that's the real work; solve it directly (the seam).
5. Add up the cost, confirm the win.

The split is never the hard part. The **seam** is where you actually think — here it's the
crossing scan, in merge sort it's the merge, in closest-pair it's the strip check.
