import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  },
  {
    // Backend source must use the Winston logger instead of console.log so
    // production logs stay structured. console.error is allowed for top-level
    // catch blocks where the logger may not be available.
    files: ["stellar-payment-platform/src/**"],
    rules: {
      "no-console": ["error", { allow: ["error"] }]
    }
  },
  {
    files: ["**/*.test.js"],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  }
];