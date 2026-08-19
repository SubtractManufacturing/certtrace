# Live shape list, not a per-material snapshot

A material's size must follow the library's current Shape field and dimension fields, not a field list frozen when the material was saved. Adding a dimension is always safe; renaming a field's label keeps stored values; removing a field drops that dimension from materials after an explicit confirm. Snapshotting a private schema on each material would make same-shape sizes incomparable and turn size back into a hidden catalog.
