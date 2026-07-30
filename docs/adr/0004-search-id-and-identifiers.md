# Search is ID and identifiers; filters do the rest

The materials search box matches only material ID and identifier values. All other discovery (Family, Alloy, Temper, Supplier, Traceability Type, dates, location, etc.) uses filters driven by the field/identifier schema (per-definition Filterable flag). Barcode search is dropped for now. Rejected: free-text search across every field (noisy with long text/notes; fights structured custom fields).
