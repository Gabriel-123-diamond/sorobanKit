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
    // Security: API key hash comparisons must be constant-time to avoid
    // timing side channels. Use crypto.timingSafeEqual instead of === / !==
    // when comparing API key hashes.
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "BinaryExpression[operator=/^[!=]==$/] > Identifier[name=/keyHash|apiKeyHash|hash/i]",
          message:
            "API key hash comparisons must use crypto.timingSafeEqual to avoid timing attacks."
        },
        {
          selector:
            "BinaryExpression[operator=/^[!=]==$/] > MemberExpression > Identifier[name=/keyHash|apiKeyHash|hash/i]",
          message:
            "API key hash comparisons must use crypto.timingSafeEqual to avoid timing attacks."
        }
      ]
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