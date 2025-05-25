/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import js from "@eslint/js";
import * as tseslint from "typescript-eslint";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  // 1) Base JS recommended rules
  js.configs.recommended,

  // 2) TypeScript + Prettier
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "simple-import-sort": simpleImportSort,
      prettier: prettierPlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "brace-style": ["error", "1tbs", { allowSingleLine: false }],
      curly: ["error", "all"],
      "simple-import-sort/imports": "error",
      // Run Prettier as an ESLint rule
      "prettier/prettier": "error",
      "no-unused-vars": [
        1,
        {
          argsIgnorePattern: "^err",
        },
      ],
    },
  },

  // 3) JavaScript/JSX + Prettier only
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },

  // 4) Turn off any ESLint rules that conflict with Prettier
  prettierConfig,

  // 5) Ignore build output and lockfiles
  {
    ignores: ["dist", "node_modules", "pnpm-lock.yaml"],
  },
];
