# AGENTS

This repository uses pnpm for package management.

## Programmatic checks

Before committing or opening a pull request, run the following commands and ensure they pass:

```sh
pnpm lint:prettier
pnpm lint:eslint
pnpm build:tsc
pnpm build:web
pnpm build:tv
pnpm build:mobile
pnpm test
```

Use `pnpm format` to automatically fix formatting issues, which often helps
`pnpm lint` pass.

Only proceed if all commands succeed.

## Coding guidelines

- Annotate all TypeScript variables, parameters, and return types explicitly,
  even if the compiler could infer them. This includes giving every variable
  an explicit type after the variable name (e.g., `const foo: number = 1;`).
- Optimize code for readability and understandability.
- Use plentiful comments to clarify the purpose and functioning of code.
- Poorly commented code will be rejected during review.
- Choose descriptive variable names that clearly convey their purpose.
- Avoid relying on global variables. Use module imports or scoped variables
  instead.
- Comment style: use Doxygen-style `/** ... */` blocks; `@tag` lines have no trailing period; prose sentences inside block comments use periods; `//` comments use no trailing period when they are a single sentence and use periods when they contain multiple sentences. Insert newlines in doxy comments between tag types.
- New TypeScript source files must use PascalCase filenames by default.
- Class-first policy: if a new file’s primary export is a class, the filename must match that class name exactly in PascalCase.
- Do not create new lowercase-named TypeScript source files for new shared logic, helper modules, or architectural code.
- Prefer introducing a small named class in a PascalCase file over adding anonymous inline state logic or lowercase utility modules, unless extending an existing local pattern clearly makes the code simpler.
- Lowercase filenames are only acceptable when modifying an existing lowercase file that already belongs to an established convention in that part of the repo.
- Start new files with the project copyright header (using the current year) whenever possible.

  For TypeScript or languages that use block comments:

  ```ts
  /*
   * Copyright (C) 2026 Garrett Brown
   * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
   *
   * SPDX-License-Identifier: AGPL-3.0-or-later
   * See the file LICENSE.txt for more information.
   */
  ```

  For files that use `#` style comments:

  ```
  ################################################################################
  #
  #  Copyright (C) 2026 Garrett Brown
  #  This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
  #
  #  SPDX-License-Identifier: AGPL-3.0-or-later
  #  See the file LICENSE.txt for more information.
  #
  ################################################################################
  ```
