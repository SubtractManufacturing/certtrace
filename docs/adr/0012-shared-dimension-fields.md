# Dimension fields are shared; shape options reference them

Each Shape option lists which dimension fields it uses and its size pattern, but those fields belong to the library field schema — one `width`, one `diameter`, not a private Width per Shape. Sharing keeps columns, filters, sort, and labels coherent when Square bar and Rectangle bar both mean width. The Shape editor can still create a new number field and immediately list it on that option. Rejected: a private dimension list per Shape, which duplicates fields and makes “sort by size” ambiguous.
