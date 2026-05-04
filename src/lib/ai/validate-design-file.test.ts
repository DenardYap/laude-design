import { Component } from 'react';
import { describe, expect, it } from "vitest";

import { formatLintErrorsForModel, validateDesignFile } from "./validate-design-file";

// A minimal valid React component — satisfies all checks for /App.tsx
const VALID_APP_TSX = `

export default function App() {
  return <div>Hello world</div>;
}
`.trim();

describe("validateDesignFile — valid files", () => {
  it("accepts a well-formed /App.tsx with a default export", () => {
    expect(validateDesignFile("/App.tsx", VALID_APP_TSX)).toEqual([]);
  });

  it("accepts a non-App.tsx file without a default export", () => {
    const code = `export const helper = () => 42;`;
    expect(validateDesignFile("/utils.ts", code)).toEqual([]);
  });

  it("accepts a .ts file with type-only exports", () => {
    const code = `export type Foo = { bar: string };`;
    expect(validateDesignFile("/types.ts", code)).toEqual([]);
  });

  it("accepts a .jsx file with a default export", () => {
    const code = `export default function Button() { return null; }`;
    expect(validateDesignFile("/Button.jsx", code)).toEqual([]);
  });

  it("accepts a .js file", () => {
    const code = `const x = 1; export { x };`;
    expect(validateDesignFile("/utils.js", code)).toEqual([]);
  });

  it("accepts a .css file without any content analysis", () => {
    const css = `.container { display: flex; gap: 8px; }`;
    expect(validateDesignFile("/styles.css", css)).toEqual([]);
  });

  it("accepts /App.tsx with `export default class`", () => {
    const code = `import React from "react"; export default class App extends Component { render() { return null; } }`;
    expect(validateDesignFile("/App.tsx", code)).toEqual([]);
  });

  it("accepts /App.tsx with `export { App as default }` re-export", () => {
    const code = `
import React from "react";
function App() { return null; }
export { App as default };
`.trim();
    expect(validateDesignFile("/App.tsx", code)).toEqual([]);
  });

  it("accepts relative imports", () => {
    const code = `
import { helper } from "./utils";
export default function App() { return null; }
`.trim();
    expect(validateDesignFile("/App.tsx", code)).toEqual([]);
  });

  it("accepts lucide-react imports", () => {
    const code = `
import { ArrowRight } from "lucide-react";
export default function App() { return null; }
`.trim();
    expect(validateDesignFile("/App.tsx", code)).toEqual([]);
  });

  it("accepts react-dom/client subpath import", () => {
    const code = `
import { createRoot } from "react-dom/client";
export default function App() { return null; }
`.trim();
    expect(validateDesignFile("/App.tsx", code)).toEqual([]);
  });
});

describe("validateDesignFile — invalid extension", () => {
  it("rejects a .html file", () => {
    const errors = validateDesignFile("/index.html", "<html></html>");
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("invalid-extension");
  });

  it("rejects a .py file", () => {
    const errors = validateDesignFile("/script.py", "print('hello')");
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("invalid-extension");
  });

  it("rejects a file with no extension", () => {
    const errors = validateDesignFile("/Makefile", "all:");
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("invalid-extension");
  });

  it("includes the allowed extensions in the error message", () => {
    const errors = validateDesignFile("/image.svg", "<svg/>");
    expect(errors[0].message).toMatch(/\.tsx/);
    expect(errors[0].message).toMatch(/\.css/);
  });

  it("returns early on invalid extension (no further checks)", () => {
    // Even though there's a syntax error in the content, we only get the
    // extension error because we return early.
    const errors = validateDesignFile("/bad.html", "{{{{");
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("invalid-extension");
  });
});

describe("validateDesignFile — syntax errors", () => {
  it("reports a syntax error for unclosed JSX", () => {
    const code = `
export default function App() {
  return <div>
}
`.trim();
    const errors = validateDesignFile("/App.tsx", code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.code === "syntax")).toBe(true);
  });

  it("includes line and column info for syntax errors", () => {
    const code = `export default function App() {{{`;
    const errors = validateDesignFile("/App.tsx", code);
    const syntaxError = errors.find((e) => e.code === "syntax");
    expect(syntaxError).toBeDefined();
    expect(typeof syntaxError!.line).toBe("number");
    expect(typeof syntaxError!.column).toBe("number");
    expect(syntaxError!.line).toBeGreaterThan(0);
    expect(syntaxError!.column).toBeGreaterThan(0);
  });

  it("bails after syntax errors (no import/export checks piled on)", () => {
    // The file has a syntax error AND a disallowed import, but we should
    // only see syntax errors so the model gets a clear signal to fix first.
    const code = `
import axios from "axios";
export default function App() {{{
`.trim();
    const errors = validateDesignFile("/App.tsx", code);
    expect(errors.every((e) => e.code === "syntax")).toBe(true);
  });
});

describe("validateDesignFile — disallowed imports", () => {
  it("rejects an import from a package not in the allowlist", () => {
    const code = `
import axios from "axios";
export default function App() { return null; }
`.trim();
    const errors = validateDesignFile("/App.tsx", code);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("disallowed-import");
    expect(errors[0].message).toContain("axios");
  });

  it("rejects multiple disallowed imports", () => {
    const code = `
import axios from "axios";
import moment from "moment";
export default function App() { return null; }
`.trim();
    const errors = validateDesignFile("/App.tsx", code);
    expect(errors).toHaveLength(2);
    expect(errors.every((e) => e.code === "disallowed-import")).toBe(true);
  });

  it("rejects a scoped package not in the allowlist", () => {
    const code = `
import { useQuery } from "@tanstack/react-query";
export default function App() { return null; }
`.trim();
    const errors = validateDesignFile("/App.tsx", code);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("disallowed-import");
  });

  it("mentions allowed packages in the error message", () => {
    const code = `
import _ from "lodash";
export default function App() { return null; }
`.trim();
    const errors = validateDesignFile("/App.tsx", code);
    expect(errors[0].message).toMatch(/react/);
    expect(errors[0].message).toMatch(/lucide-react/);
  });

  it("allows imports from files in the same design (relative paths)", () => {
    const code = `
import { utils } from "./utils";
export default function App() { return null; }
`.trim();
    expect(validateDesignFile("/App.tsx", code)).toEqual([]);
  });

  it("allows absolute-style relative imports starting with /", () => {
    // Sandpack supports /component style imports
    const code = `
import Button from "/Button";
export default function App() { return null; }
`.trim();
    expect(validateDesignFile("/App.tsx", code)).toEqual([]);
  });
});

describe("validateDesignFile — missing default export on /App.tsx", () => {
  it("reports missing-default-export for /App.tsx with no default", () => {
    const code = `export const helper = () => 42;`;
    const errors = validateDesignFile("/App.tsx", code);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("missing-default-export");
    expect(errors[0].message).toMatch(/App\.tsx/);
    expect(errors[0].message).toMatch(/export default/);
  });

  it("does NOT require default export for non-App.tsx files", () => {
    const code = `export const helper = () => 42;`;
    expect(validateDesignFile("/components/Button.tsx", code)).toEqual([]);
  });

  it("only checks /App.tsx (exact path, not substring)", () => {
    const code = `export const helper = () => 42;`;
    // A nested App.tsx should NOT trigger the default-export check
    expect(validateDesignFile("/components/App.tsx", code)).toEqual([]);
  });
});

describe("validateDesignFile — combined errors", () => {
  it("reports disallowed-import AND missing-default-export together", () => {
    const code = `import axios from "axios";`;
    const errors = validateDesignFile("/App.tsx", code);
    const codes = errors.map((e) => e.code);
    expect(codes).toContain("disallowed-import");
    expect(codes).toContain("missing-default-export");
  });
});

describe("formatLintErrorsForModel", () => {
  it("includes the file path in the header line", () => {
    const errors = validateDesignFile("/App.tsx", `export const x = 1;`);
    const formatted = formatLintErrorsForModel("/App.tsx", errors);
    expect(formatted).toContain("/App.tsx");
  });

  it("lists each error with its code", () => {
    const errors = validateDesignFile("/App.tsx", `import axios from "axios";`);
    const formatted = formatLintErrorsForModel("/App.tsx", errors);
    expect(formatted).toContain("[disallowed-import]");
    expect(formatted).toContain("[missing-default-export]");
  });

  it("includes line and column for syntax errors", () => {
    const code = `export default function App() {{{`;
    const errors = validateDesignFile("/App.tsx", code);
    const formatted = formatLintErrorsForModel("/App.tsx", errors);
    // Should mention line/col info
    expect(formatted).toMatch(/line \d+/);
    expect(formatted).toMatch(/col \d+/);
  });

  it("does not include line info for non-syntax errors", () => {
    const code = `import axios from "axios"; export default function App() { return null; }`;
    const errors = validateDesignFile("/App.tsx", code);
    const formatted = formatLintErrorsForModel("/App.tsx", errors);
    // disallowed-import has no line info
    expect(formatted).not.toMatch(/\(line \d+/);
  });

  it("instructs the model to call the same tool again", () => {
    const errors = validateDesignFile("/App.tsx", `export const x = 1;`);
    const formatted = formatLintErrorsForModel("/App.tsx", errors);
    expect(formatted).toMatch(/call the same tool again/i);
  });
});
