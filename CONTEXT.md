# CertTrace

Desktop app for CNC job shops to track physical stock pieces and their certification paperwork in local filesystem libraries.

## Language

### Stock & libraries

**Material**:
One physical piece (or remnant) of stock that can be labeled, stored, and certified. The unit of identity in CertTrace — one material ID refers to one piece, not a lot, PO line, or heat. A material may have a shape and a size; neither is required.
_Avoid_: Lot, receipt, PO line, inventory item (when meaning the CertTrace record)

**Library**:
A filesystem folder that holds a set of materials, their attachments, and that library's configuration (fields, identifier kinds, naming rules, word lists).
_Avoid_: Database, project, workspace (for this concept)

**Library backup**:
A portable ZIP file, kept outside the Library, that is a complete copy of one Library's shop records — every Material (including Archived), Attachment, Job, and that library's configuration.
_Avoid_: Archive (for this file), Export (unless speaking loosely)

**Library restore**:
An independent copy of a Library created by unpacking a ZIP that is already a Library (same meaning as opening a folder) into a new folder named after that Library, under a parent folder the shop chooses. Same name, material IDs, jobs, and attachments as the source; not linked to it, and never written into an existing path.
_Avoid_: Import (unless speaking loosely), Unarchive, Overwrite in place, Clone (as a linked or synced copy)

### Classification fields

**Family**:
The broad material class of a piece — e.g. Aluminum, Steel, Brass, Plastic. Shipped as a default single-select field (stable key `family`); the default UI label is **Material** because that is how shops talk, but in docs and domain language this concept is Family so it is not confused with the piece.
_Avoid_: Calling this concept Material in docs/ADRs (UI label “Material” is fine), Type, Category

**Alloy**:
The specific grade or formulation within a family — e.g. 6061, Ultem. Typically depends on Family.
_Avoid_: Material (when meaning grade), Grade (unless a shop renames the field)

**Temper**:
The heat-treat / condition state of the piece — e.g. T6511, H900, Annealed, Normalized. A property of the material that can be shared across many pieces of the same family/alloy. Not a document number.
_Avoid_: Heat (alone), Condition (unless a shop renames the field), Heat number

**Shape**:
The form factor of a material, stored as a field — plate, round bar, square bar, tube, and the like. Each shape option names the dimensions and size pattern that apply.
_Avoid_: Form, profile, material type, size type, measurement method (unless a shop renames the field)

**Supplier**:
Who the piece was purchased from — e.g. McMaster, Boedecker.

**Traceability Type**:
How complete the cert package is for this piece — e.g. Material cert, COC, Full Traceability. Descriptive metadata only; it does not require or validate attachments.
_Avoid_: Cert level (unless a shop renames the field)

**Storage Location**:
Where the piece lives in the shop — e.g. Rack B2.

**Date Received**:
The date the piece arrived.

**Archived**:
A Material lifecycle state meaning the physical piece is no longer active stock in the shop. The Material remains in the same Library with the same identity, identifiers, and attachments, and can be unarchived to active. Distinct from deletion (permanent removal), from Storage Location, and from Library restore.
_Avoid_: Soft-delete (as the product name for this), Inactive, Retired (unless speaking loosely), Archive library (a separate Library used only as a graveyard), Restore (for this action — that is Library restore)

### Size

**Dimension**:
A named length — thickness, diameter, width, height, OD, wall — stored as a number field. Several shapes may list the same dimension. Shipped dimension fields cannot be deleted; a shop may add more and delete those.
_Avoid_: Size type

**Size**:
The measured cross-section of one material. A size has exactly one unit, shared by all of its dimensions, and may leave some dimensions empty. Size is not a catalog entry and is not remaining length.
_Avoid_: Stock size, SKU, dimensions catalog, label stock size

**Size pattern**:
The written form of a size for a shape, used on labels and in the materials list. Each shape has one pattern the shop may edit.
_Avoid_: Size format, size template

**Unit**:
Inch or millimeter. Preset by the app, not a field. A size keeps the unit it was entered in; labels and lists show that unit. Each install has a default unit (shipped as inch). Each library chooses inch, millimeter, or App default.
_Avoid_: Metric, imperial, size_unit field

### Identifiers

**Identifier**:
A lookup key on a material used to find that piece (and possibly others that share the same value) — e.g. a purchase order number, lot number, or heat number. Distinct from classification fields like Family or Temper.
_Avoid_: Field (when meaning an identifier), Tag, Barcode

**Identifier kind**:
A library-defined type of identifier — e.g. Heat Number, Lot Number, Purchase Order. Kinds are configured per library; values live on each material. Users may add or remove kinds.
_Avoid_: Custom field, Attribute (for this concept)

**Heat Number**:
An identifier whose value is the document number on heat-treat / mill certification paperwork that ties that cert to the piece. Not the temper/condition.
_Avoid_: Heat, Temper, Melt number (unless a shop renames the kind)

**Lot Number**:
An identifier for the supplier or mill lot the piece belongs to. May be shared across many materials.

**Purchase Order**:
An identifier for the order the piece was bought on. Commonly shared across many materials from the same order.
_Avoid_: PO (in docs — fine in UI labels), Order number (unless a shop renames the kind)

### Schema & configuration

**Field**:
A library-defined attribute on materials (text, long text, single-select, multi-select, date, or number), including dependency rules between fields. Distinct from identifiers and from attachments.
_Avoid_: Property, Column, Metadata key (in domain language)

**Attachment**:
A file stored with a material (cert PDF, photo, etc.).

**Attachment kind**:
A library-defined label for what an attachment is — e.g. MTR, Heat cert, COC, Other. Descriptive only; kinds do not enforce that a material must have certain files.
_Avoid_: File type (when meaning cert role — that is pdf/png/etc.), Document type

**Option short code**:
An optional compact code on a select option (e.g. Aluminum → `AL`) used by material ID templates. When a template asks for that field's token and no short code is set, the option's display name is used instead.
_Avoid_: Material code (as a separate free-floating concept), Prefix (unless speaking loosely)

### Jobs

**Job**:
A first-class shop work record owned by a Library, identified by a user-entered job number, with a shop-entered job date and optional customer name and notes. Used to audit which Materials (and their certs) relate to that work — not to reserve or track inventory.
_Avoid_: Work order (unless a shop renames), Order (confused with Purchase Order), Job as an identifier kind on Material

**Job number**:
The user-entered unique key of a Job within its Library. Uniqueness is case-insensitive after trimming ends; CertTrace does not invent a separate human-facing job code.
_Avoid_: System job id (as the shop-facing key), Work order number (unless a shop renames)

**Job date**:
The shop-entered date on a Job used to find and order jobs. Not the record’s created-at timestamp and not auto-filled.
_Avoid_: Created at (for this concept), Due date (unless that is what the shop means by the date)

**Job customer**:
An optional free-text name on a Job used only to find and filter jobs. Not a first-class Customer record, screen, or profile.
_Avoid_: Customer entity, Client, Account, Customer profile

**Job assignment**:
A historical many-to-many link between a Job and a Material recording that the material (and its certification paperwork) relates to that job for audit. Not a reservation or current allocation of stock.
_Avoid_: Reservation, Allocation, Inventory assignment

### Labels

**Label**:
A physical sticker or sheet attached to a Material that shows selected identifying information so the piece can be recognized on the rack and looked up in CertTrace.
_Avoid_: Sticker (unless speaking loosely), Tag (for this concept)

**Label Template**:
A named, library-owned recipe for Labels: paper size (from a shipped catalog or custom dimensions, with a per-template display unit) plus an ordered list of content items — which Material information (and optional machine-readable code) appears, each with horizontal alignment (left/center/right) and a relative size (small/medium/large). CertTrace auto-lays out the content for that size using those per-item hints, and may pack wide/short sizes into multiple columns from the same linear order when a single stack would not fit. Machine-readable codes (QR and/or barcode), when included, encode the Material id; QR may carry a richer payload in a later revision. Included fields with no value on a Material still appear with a visible placeholder. Each library has one default Label Template used when printing or exporting, and may keep additional templates the user can pick instead. New libraries ship starters for `4×6 in` (default), `8.5×11 in`, and `3×1 in`.
_Avoid_: Label format, Label type, Label preset (unless speaking loosely about built-in starting sizes)
