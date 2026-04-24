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
 * Detection heuristics on JSX text nodes:
 *  - Pure number literal:                    >{42}<
 *  - Member-access count/length/size:        >{xxx.length}<  >{xxx.count}<  >{xxx.size}<
 *  - Variables ending in Count / Total:      >{overdueCount}<  >{filterCount}<
 *  - Percentages:                            >{value}%<  >{value.toFixed(0)}%<
 *  - Ratios:                                 >{a}/{b}<
 *  - Math.* arithmetic:                      >{Math.round(x)}<
 *
 * False-positive guards :
 *  - Skip text segments that are clearly inside a JS expression (template
 *    literals `${...}`, regex literals `/^...\d{...}.../`).
 *  - Skip when an ancestor element (up to 8 levels) carries `data-numeric`.
 */

const ROOT = join(process.cwd(), "src");

// Directories we ignore entirely
const IGNORED_DIRS = new Set([
  "test",
  "integrations", // generated supabase types
  "ui",           // shadcn primitives — generic, no numeric semantics
]);

// Files we ignore
const IGNORED_FILES = new Set<string>([
  "vite-env.d.ts",
]);

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
 * Locate JSX text nodes that contain at least one `{...}` expression and
 * lie strictly between a real JSX `>` (end of an opening tag) and a real
 * JSX `<` (start of the next tag).
 *
 * We pre-process the source to mask out:
 *   - string / template literals (so `"a < b"` or `` `${x}` `` cannot
 *     pollute the angle-bracket scanner),
 *   - regex literals (so `/^\d{4}/` is invisible to the scanner),
 *   - block + line comments,
 *   - JSX attribute values that contain comparison operators.
 *
 * The masked source preserves offsets (replaced char-by-char with a
 * filler char) so we can still report accurate line numbers.
 */
function maskNonJsx(src: string): string {
  const out = src.split("");
  const FILL = " ";
  let i = 0;
  const n = src.length;

  const fill = (start: number, end: number) => {
    for (let k = start; k < end; k++) {
      // Preserve newlines so line numbers stay correct
      if (out[k] !== "\n") out[k] = FILL;
    }
  };

  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];

    // Line comment
    if (ch === "/" && next === "/") {
      let j = i + 2;
      while (j < n && src[j] !== "\n") j++;
      fill(i, j);
      i = j;
      continue;
    }
    // Block comment
    if (ch === "/" && next === "*") {
      let j = i + 2;
      while (j < n - 1 && !(src[j] === "*" && src[j + 1] === "/")) j++;
      fill(i, Math.min(j + 2, n));
      i = j + 2;
      continue;
    }
    // String literal "..."
    if (ch === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') {
        if (src[j] === "\\") j++;
        j++;
      }
      fill(i, j + 1);
      i = j + 1;
      continue;
    }
    // String literal '...'
    if (ch === "'") {
      let j = i + 1;
      while (j < n && src[j] !== "'") {
        if (src[j] === "\\") j++;
        j++;
      }
      fill(i, j + 1);
      i = j + 1;
      continue;
    }
    // Template literal `...`  (with nested ${ ... } expressions)
    if (ch === "`") {
      let j = i + 1;
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === "$" && src[j + 1] === "{") {
          // skip balanced braces
          let depth = 1;
          j += 2;
          while (j < n && depth > 0) {
            if (src[j] === "{") depth++;
            else if (src[j] === "}") depth--;
            j++;
          }
          continue;
        }
        j++;
      }
      fill(i, j + 1);
      i = j + 1;
      continue;
    }
    // Regex literal — heuristic: a `/` that follows an operator / `(` / `,` / `=` / `:` / `!` / `&` / `|` / `?` / `;` / `{` / `[` / `\n`
    if (ch === "/") {
      // look back to nearest non-space char
      let p = i - 1;
      while (p >= 0 && /\s/.test(src[p])) p--;
      const prev = p >= 0 ? src[p] : "";
      if ("(,=:!&|?;{[".includes(prev) || prev === "" || prev === "\n") {
        let j = i + 1;
        while (j < n && src[j] !== "\n" && src[j] !== "/") {
          if (src[j] === "\\") {
            j += 2;
            continue;
          }
          if (src[j] === "[") {
            // character class, may contain unescaped `/`
            j++;
            while (j < n && src[j] !== "]") {
              if (src[j] === "\\") j++;
              j++;
            }
          }
          j++;
        }
        // include trailing flags
        let k = j + 1;
        while (k < n && /[a-z]/.test(src[k])) k++;
        if (j < n && src[j] === "/") {
          fill(i, k);
          i = k;
          continue;
        }
      }
    }
    i++;
  }

  return out.join("");
}

/**
 * Extract JSX text segments from the masked source. A segment is the text
 * between a `>` and a `<` that contains at least one `{...}` expression.
 */
function extractJsxTextSegments(masked: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  const re = />([^<>]*\{[^<>]*\}[^<>]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    out.push({ text: m[1], offset: m.index + 1 });
  }
  return out;
}

/**
 * Walk back from position `from` (exclusive) and return the immediately
 * previous JSX tag (opener, closer or self-closing). Skips over text
 * content (anything that is not `<` or `>`) until a tag boundary is found.
 */
function findPrevTag(masked: string, from: number): { start: number; end: number; isCloser: boolean; isSelfClosing: boolean } | null {
  // Find the previous `>`
  let i = from - 1;
  while (i >= 0 && masked[i] !== ">") i--;
  if (i < 0) return null;
  const end = i;
  // Find its matching `<`
  let j = end - 1;
  while (j >= 0 && masked[j] !== "<") j--;
  if (j < 0) return null;
  const tagText = masked.slice(j, end + 1);
  return {
    start: j,
    end,
    isCloser: tagText.startsWith("</"),
    isSelfClosing: /\/\s*>$/.test(tagText),
  };
}

/**
 * Find the JSX opening tag that directly encloses the JSX text segment
 * starting at `offset`. Skips over balanced sibling pairs `<X>...</X>`
 * and self-closing siblings `<X />`.
 *
 * Requires that `offset` sits immediately after a `>` (with optional
 * whitespace), otherwise the segment isn't actually inside JSX.
 */
function findEnclosingOpenTag(masked: string, offset: number): { tag: string; start: number } | null {
  // Validate the segment really is JSX text: char before (after skipping
  // whitespace) must be `>`.
  let probe = offset - 1;
  while (probe >= 0 && /\s/.test(masked[probe])) probe--;
  if (probe < 0 || masked[probe] !== ">") return null;

  let cur = offset;
  let pendingClosers = 0;
  while (true) {
    const t = findPrevTag(masked, cur);
    if (!t) return null;
    if (t.isCloser) {
      pendingClosers++;
    } else if (t.isSelfClosing) {
      // self-closing sibling — neither encloses us nor needs balancing
    } else if (pendingClosers > 0) {
      pendingClosers--;
    } else {
      return { tag: masked.slice(t.start, t.end + 1), start: t.start };
    }
    cur = t.start;
  }
}

function isNumericExpression(expr: string): boolean {
  const e = expr.trim();
  if (!e) return false;

  // Skip type assertions / generics / spread / function calls with strings
  if (e.includes("'") || e.includes('"')) return false;

  // Pure integer or float literal
  if (/^-?\d+(\.\d+)?$/.test(e)) return true;

  // .length / .count / .size accessor at the end
  if (/\.(length|count|size)\s*$/.test(e)) return true;

  // Identifier ending with Count or Total (e.g. overdueCount, filterCount)
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

function hasNumericAncestor(masked: string, offset: number): boolean {
  let cur = offset;
  for (let depth = 0; depth < 8; depth++) {
    const found = findEnclosingOpenTag(masked, cur);
    if (!found) return false;
    if (/\bdata-numeric\b/.test(found.tag)) return true;
    // Move just before the `<` of this tag and continue walking up
    cur = found.start;
  }
  return false;
}

function analyzeFile(file: string, src: string): Violation[] {
  const violations: Violation[] = [];
  const masked = maskNonJsx(src);
  const segments = extractJsxTextSegments(masked);

  for (const { text, offset } of segments) {
    if (!text.trim()) continue;

    const reasons: string[] = [];

    // 1. Percentage: ...{expr}%...
    if (/\{[^{}]+\}\s*%/.test(text)) {
      reasons.push("percentage display");
    }

    // 2. Ratio: ...{a}/{b}...
    if (/\}\s*\/\s*\{/.test(text)) {
      reasons.push("ratio display (a/b)");
    }

    // 3. Standalone numeric expression(s)
    const exprRe = /\{([^{}]+)\}/g;
    let em: RegExpExecArray | null;
    while ((em = exprRe.exec(text)) !== null) {
      const inner = em[1];
      if (isNumericExpression(inner)) {
        reasons.push(`numeric expression: {${inner.trim()}}`);
        break;
      }
    }

    if (reasons.length === 0) continue;

    // Skip if any ancestor (up to 8 levels) carries data-numeric
    if (hasNumericAncestor(masked, offset)) continue;

    // Make sure we are in a real JSX context
    const found = findEnclosingOpenTag(masked, offset);
    if (!found) continue;

    const line = src.slice(0, offset).split("\n").length;
    violations.push({
      file,
      line,
      snippet: text.trim().replace(/\s+/g, " ").slice(0, 120),
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
