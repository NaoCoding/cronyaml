import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.js", "**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    rules: {
      "no-console": "off",
      "no-unused-vars": "off",
    },
  },
];
