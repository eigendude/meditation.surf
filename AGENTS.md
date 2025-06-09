# AGENTS

This repository uses pnpm for package management.

## Programmatic checks

Before committing or opening a pull request, run the following commands and ensure they pass:

```sh
pnpm lint
pnpm build
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
- Start new files with the project copyright header (using the current year) whenever possible.

  For TypeScript or languages that use block comments:

  ```ts
  /*
   * Copyright (C) 2025 Garrett Brown
   * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
   *
   * SPDX-License-Identifier: AGPL-3.0-or-later
   * See the file LICENSE.txt for more information.
   */
  ```

  For files that use `#` style comments:

  ```
  ################################################################################
  #
  #  Copyright (C) 2025 Garrett Brown
  #  This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
  #
  #  SPDX-License-Identifier: AGPL-3.0-or-later
  #  See the file LICENSE.txt for more information.
  #
  ################################################################################
  ```
