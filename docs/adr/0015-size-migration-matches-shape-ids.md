# Size migration fills shipped Shape ids only

When Size lands, existing libraries keep their Shape options. Starter dimensions, patterns, and shared number fields attach only to known shipped option ids (`plate`, `round_bar`, and the like). Rectangle bar is inserted only if that id is missing. Custom or renamed options stay unpacked until the shop edits them. Rejected: resetting Shape options to the starter set, and inferring dimensions from option labels.
