import * as ts from "typescript";

import type { DesignFileLintError } from "./types/validate-design-file";

export type { DesignFileLintError };

/**
 * Static checks we run before persisting an agent-written design file.
 *
 * Goals:
 * - Catch syntax errors (missing braces, malformed JSX, etc.) so the model
 *   gets a clear error back via the tool-error channel and can self-correct
 *   instead of shipping broken code that only blows up in the Sandpack iframe.
 * - Enforce the same import allowlist the system prompt promises, so the
 *   sandbox doesn't fail to resolve a fake module.
 * - Enforce that `/App.tsx` keeps its `export default` contract.
 *
 * Intentionally lightweight: no full type-checking, no resolving sibling
 * files, no semantic analysis. We want this to add ~10–30ms, not seconds.
 */

/**
 * The sandbox provides only these dependencies (mirrors system-prompt.ts
 * rule 5). Anything else fails to resolve at runtime, which historically
 * looked to the user like a silent design failure.
 */
const ALLOWED_PACKAGES = new Set(["react", "react-dom", "lucide-react"]);

/** Subpath imports we still want to allow (e.g. `react-dom/client`). */
function isAllowedPackage(spec: string): boolean {
  if (spec.startsWith(".") || spec.startsWith("/")) return true;
  const root = spec.startsWith("@")
    ? spec.split("/").slice(0, 2).join("/")
    : spec.split("/")[0];
  return ALLOWED_PACKAGES.has(root);
}

function scriptKindFor(path: string): ts.ScriptKind | "css" {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".ts")) return ts.ScriptKind.TS;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (path.endsWith(".js")) return ts.ScriptKind.JS;
  if (path.endsWith(".css")) return "css";
  return ts.ScriptKind.Unknown;
}

function hasDefaultExport(source: ts.SourceFile): boolean {
  for (const stmt of source.statements) {
    // `export default <expr>`
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) return true;
    // `export default function...` / `export default class...`
    const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    if (
      mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
      mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    ) {
      return true;
    }
    // `export { Foo as default }`
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) {
        if (el.name.text === "default") return true;
      }
    }
  }
  return false;
}

function collectImportSpecifiers(source: ts.SourceFile): string[] {
  const specs: string[] = [];
  for (const stmt of source.statements) {
    if (
      ts.isImportDeclaration(stmt) &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      specs.push(stmt.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(stmt) &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      specs.push(stmt.moduleSpecifier.text);
    }
  }
  return specs;
}

export function validateDesignFile(
  path: string,
  content: string,
): DesignFileLintError[] {
  const errors: DesignFileLintError[] = [];

  const kind = scriptKindFor(path);
  if (kind === ts.ScriptKind.Unknown) {
    errors.push({
      code: "invalid-extension",
      message: `Unsupported file extension for ${path}. Only .tsx, .ts, .jsx, .js, and .css are allowed.`,
    });
    return errors;
  }

  // CSS files don't need TypeScript parsing or import/export analysis.
  if (kind === "css") return errors;

  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    kind,
  );

  // Surface every parser diagnostic. These are real syntax problems the
  // sandbox will never recover from, so blocking is the right call.
  const parseDiagnostics = (source as unknown as {
    parseDiagnostics: ts.DiagnosticWithLocation[];
  }).parseDiagnostics;

  for (const diag of parseDiagnostics ?? []) {
    const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
    const pos = ts.getLineAndCharacterOfPosition(source, diag.start);
    errors.push({
      code: "syntax",
      message,
      line: pos.line + 1,
      column: pos.character + 1,
    });
  }

  // Bail before semantic checks if parsing failed — node positions can be
  // unreliable and we'd just be piling on confusing errors.
  if (errors.length > 0) return errors;

  for (const spec of collectImportSpecifiers(source)) {
    if (!isAllowedPackage(spec)) {
      errors.push({
        code: "disallowed-import",
        message: `Import "${spec}" is not available in the sandbox. Allowed packages: react, react-dom, lucide-react. Use relative imports for your own files.`,
      });
    }
  }

  if (path === "/App.tsx" && !hasDefaultExport(source)) {
    errors.push({
      code: "missing-default-export",
      message:
        "/App.tsx must `export default` a React component (it's the entrypoint the sandbox renders).",
    });
  }

  return errors;
}

/**
 * Format errors into a single string the model will see as the tool failure
 * message. Keep it terse and structured — long prose tends to make the model
 * apologize instead of fixing the actual issue.
 */
export function formatLintErrorsForModel(
  path: string,
  errors: DesignFileLintError[],
): string {
  const lines = errors.map((e) => {
    const where = e.line ? ` (line ${e.line}, col ${e.column})` : "";
    return `- [${e.code}]${where} ${e.message}`;
  });
  return [
    `Validation failed for ${path}. Fix the issues below and call the same tool again with corrected content.`,
    ...lines,
  ].join("\n");
}
