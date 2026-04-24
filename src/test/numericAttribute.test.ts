import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Static analysis test : scan all TSX files and detect numeric displays
 * (counters, percentages, ratios) without the `data-numeric` attribute.
 *
 * Numeric displays MUST carry `data-numeric` so the global CSS rule in
 * `src/index.css` applies the dedicated numeric font + tabular-nums.
 *
 * Detection heuristics on JSX text nodes (between `>` and `<`):
 *  - Pure number literal:                    >{42}<
 *  - Member-access count/length/size:        >{xxx.length}<  >{xxx.count}<  >{xxx.size}<
 *  - Variables ending in Count / Total:      >{overdueCount}<  >{filterCount}<
 *  - Percentages:                            >{value}%<  >{value.toFixed(0)}%<
 *  - Ratios:                                 >{a}/{b}<
 *  - Arithmetic / Math expressions:          >{Math.round(x)}<  >{a - b}<
 *
 * For each match, we walk back to the enclosing JSX opening tag and
 * verify it contains `data-numeric`. Tags inside the same parent that
 * already carry `data-numeric` are considered safe (CSS inherits via
 * the [data-numeric] attribute selector).
 */

const ROOT = join(process.cwd(), "src");

// Directories we ignore entirely
const IGNORED_DIRS = new Set([
  "test",
  "integrations", // generated supabase types
  "ui",           // shadcn primitives — generic, no numeric semantics
]);

// Files we ignore (tests, generated, or pure logic)
const IGNORED_FILES = new Set<string>([
  "vite-env.d.ts",
]);

// Whitelist : known acceptable matches that are NOT user-visible numeric
// displays (icon size props, style values, keys, conditionals, etc.).
// Each entry is the exact JSX text capture between `>` and `<`.
const WHITELIST_SNIPPETS: RegExp[] = [
  // Empty-ish or layout-only
  /^\s*$/,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (IGNORED_DIRS.has(entry)) continue;
      walk(full, acc);
    } else if (entry.endsWith(".tsx") && !IGNORED_FILES.has(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Extract JSX text segments between `>` and `<` along with their absolute
 * offset in the source. Returns segments containing JSX expressions `{...}`.
 */
function extractJsxTextSegments(src: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  // Skip imports / comments crudely by working on the full file — false
  // positives are filtered later by requiring an enclosing JSX tag.
  const re = />([^<>]*\{[^<>]*\}[^<>]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ text: m[1], offset: m.index + 1 });
  }
  return out;
}

/**
 * Find the opening JSX tag that contains the segment at `offset` and return
 * its raw text (e.g. `<span className="...">`).
 */
function findEnclosingOpenTag(src: string, offset: number): string | null {
  // Walk backwards to the nearest `<` that starts a JSX tag (not `</`).
  let i = offset - 1;
  let depth = 0;
  while (i > 0) {
    const ch = src[i];
    if (ch === ">") depth++;
    else if (ch === "<") {
      if (depth === 0) {
        // Found tag start
        const end = src.indexOf(">", i);
        if (end === -1) return null;
        const tag = src.slice(i, end + 1);
        // Skip closing tags
        if (tag.startsWith("</")) {
          // Keep walking
        } else {
          return tag;
        }
      } else {
        depth--;
      }
    }
    i--;
  }
  return null;
}

function isNumericExpression(expr: string): boolean {
  const e = expr.trim();
  if (!e) return false;

  // Strip ternary / fallback wrappers: keep right-most meaningful expr
  // (we still want to flag `{count > 0 ? count : 0}` style)
  // -> simple checks first

  // Pure integer or float literal
  if (/^-?\d+(\.\d+)?$/.test(e)) return true;

  // .length / .count / .size accessor at the end
  if (/\.(length|count|size)\s*$/.test(e)) return true;

  // Identifier ending with Count or Total (e.g. overdueCount, filterCount, totalCount)
  if (/^[A-Za-z_][A-Za-z0-9_]*(Count|Total)$/.test(e)) return true;

  // Math.* arithmetic that yields a number
  if (/^Math\.(round|floor|ceil|abs|min|max)\s*\(/.test(e)) return true;

  // .toFixed(...) chains -> numeric string
  if (/\.toFixed\s*\(/.test(e)) return true;

  return false;
}

interface Violation {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

function analyzeFile(file: string, src: string): Violation[] {
  const violations: Violation[] = [];
  const segments = extractJsxTextSegments(src);

  for (const { text, offset } of segments) {
    if (WHITELIST_SNIPPETS.some(rx => rx.test(text))) continue;

    // Build numeric reasons for this text segment
    const reasons: string[] = [];

    // 1. Percentage: ...{expr}%...
    if (/\{[^{}]+\}\s*%/.test(text)) {
      reasons.push("percentage display");
    }

    // 2. Ratio: ...{a}/{b}... (slash between two JSX expressions)
    if (/\}\s*\/\s*\{/.test(text)) {
      reasons.push("ratio display (a/b)");
    }

    // 3. Standalone numeric expression(s)
    const exprRe = /\{([^{}]+)\}/g;
    let em: RegExpExecArray | null;
    while ((em = exprRe.exec(text)) !== null) {
      if (isNumericExpression(em[1])) {
        reasons.push(`numeric expression: {${em[1].trim()}}`);
        break; // one is enough to flag the segment
      }
    }

    if (reasons.length === 0) continue;

    // Check enclosing tag for data-numeric
    const tag = findEnclosingOpenTag(src, offset);
    if (!tag) continue; // not in JSX context (string literal etc.)

    // Skip non-text-rendering tags (containers that wrap children)
    // We still flag spans, p, div, h*, td, button, label, Badge, etc.
    if (/^<\s*(?:Fragment|>|React\.Fragment)/.test(tag)) continue;

    if (/\bdata-numeric\b/.test(tag)) continue;

    // Also accept if the ancestor span/div in same line uses data-numeric
    // (rare — keep conservative and report anyway).

    const line = src.slice(0, offset).split("\n").length;
    violations.push({
      file,
      line,
      snippet: text.trim().slice(0, 120),
      reason: reasons.join(", "),
    });
  }

  return violations;
}

describe("Numeric attribute coverage", () => {
  it("every numeric display in JSX must carry data-numeric", () => {
    const files = walk(ROOT);
    const allViolations: Violation[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const v = analyzeFile(file, src);
      allViolations.push(...v);
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .map(v =>
          `  • ${relative(process.cwd(), v.file)}:${v.line}\n` +
          `      ${v.reason}\n` +
          `      → ${v.snippet}`
        )
        .join("\n");
      throw new Error(
        `Found ${allViolations.length} numeric display(s) without \`data-numeric\`:\n${summary}\n\n` +
        `Add the \`data-numeric\` attribute (and \`font-numeric tabular-nums\` classes) ` +
        `to the wrapping element so the global numeric font is applied.`
      );
    }

    expect(allViolations).toHaveLength(0);
  });
});
