export default [
  {
    files: ["**/*.js"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off"
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script"
    }
  }
];
