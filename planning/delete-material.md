# Delete material

**UI:** Footer trash on the **bottom left** of the material detail modal (clear of Cancel/Save), red icon without a red base-state border, confirm dialog before permanent delete.

**Engine:** `removeMaterial(library, materialId)` permanently removes `materials/<id>/` (metadata + attachments) via recursive `FileSystem.remove`.
