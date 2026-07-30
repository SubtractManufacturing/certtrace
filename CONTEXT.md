# CertTrace

Desktop app for CNC job shops to track physical stock pieces and their certification paperwork in local filesystem libraries.

## Language

### Stock & libraries

**Material**:
One physical piece (or remnant) of stock that can be labeled, stored, and certified. The unit of identity in CertTrace — one material ID refers to one piece, not a lot, PO line, or heat.
_Avoid_: Lot, receipt, PO line, inventory item (when meaning the CertTrace record)

**Library**:
A filesystem folder that holds a set of materials, their attachments, and that library's configuration (fields, identifier kinds, naming rules, word lists).
_Avoid_: Database, project, workspace (for this concept)

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
The stock form — e.g. round bar, square bar, round tube, rectangular tube, hexagonal bar. Size/dimension templates keyed off shape are a later concern.
_Avoid_: Form, profile (unless a shop renames the field)

**Supplier**:
Who the piece was purchased from — e.g. McMaster, Boedecker.

**Traceability Type**:
How complete the cert package is for this piece — e.g. Material cert, COC, Full Traceability. Descriptive metadata only; it does not require or validate attachments.
_Avoid_: Cert level (unless a shop renames the field)

**Storage Location**:
Where the piece lives in the shop — e.g. Rack B2.

**Date Received**:
The date the piece arrived.

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

### Labels

**Label**:
A physical sticker or sheet attached to a Material that shows selected identifying information so the piece can be recognized on the rack and looked up in CertTrace.
_Avoid_: Sticker (unless speaking loosely), Tag (for this concept)

**Label Template**:
A named, library-owned recipe for Labels: paper size (from a shipped catalog or custom dimensions, with a per-template display unit) plus which Material information (and optional machine-readable code) appears, in a user-chosen order. CertTrace auto-lays out the content for that size. Machine-readable codes (QR and/or barcode), when included, encode the Material id; QR may carry a richer payload in a later revision. Included fields with no value on a Material still appear with a visible placeholder. Each library has one default Label Template used when printing or exporting, and may keep additional templates the user can pick instead.
_Avoid_: Label format, Label type, Label preset (unless speaking loosely about built-in starting sizes)
