import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Prevent XSS sink regressions — these patterns are unsafe and must
      // never appear in this codebase.
      "react/no-danger": "error",

      // Ban direct DOM mutation sinks and risky patterns.
      "no-restricted-syntax": [
        "error",
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message:
            "Direct innerHTML assignment is a potential XSS sink. Use React's JSX rendering instead.",
        },
        {
          selector: "AssignmentExpression[left.property.name='outerHTML']",
          message:
            "Direct outerHTML assignment is a potential XSS sink. Use React's JSX rendering instead.",
        },
        {
          selector: "CallExpression[callee.property.name='write'][callee.object.name='document']",
          message:
            "document.write() is a potential XSS sink and should never be used.",
        },
        {
          selector: "NewExpression[callee.name='Function']",
          message:
            "new Function() executes arbitrary code — use explicit functions instead.",
        },
      ],

      // Ban importing rehype plugins that re-enable raw HTML in react-markdown,
      // which would bypass the default sanitization.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["rehype-raw", "rehype-sanitize"],
              message:
                "rehype-raw re-enables raw HTML in react-markdown, creating XSS risk. Do not import it.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
