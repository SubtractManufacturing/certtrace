# Shape options own their dimensions and size pattern

Shops configure a Shape by editing that option: which dimensions it has and how Size is written. Putting that list on the Shape option is the thing they understand; asking them to set visibility rules on each dimension field is backwards. Dimension *values* still live as number fields on the Material so labels, columns, and filters stay one model. Field `visibleWhen` remains for Family → Alloy (and the like), not for teaching Size. Contradicts the size-by-shape part of ADR-0005; that ADR still stands for select-option filtering.
