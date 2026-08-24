import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * CSV quoting, tested against the real hazards in this data: captions contain
 * commas, quotes, newlines and emoji, and Facebook posts have no URL at all.
 *
 * Plain .mjs so `node --test` can run it without a TypeScript step; it mirrors
 * lib/csv.ts's `cell` rules exactly.
 */

function cell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Minimal RFC 4180 reader, so the test proves round-tripping rather than shape. */
function parseCsv(text) {
  const body = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      /* skip */
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

test("a caption with commas, quotes and newlines round-trips", () => {
  const caption = 'Mr. & Mrs. Guzman 💍\n\nStyling: @a, @b\nThey said "yes"';
  const csv = toCsv(["hashtag", "text"], [["weddingsph", caption]]);
  const rows = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], ["hashtag", "text"]);
  assert.equal(rows[1][1], caption, "the caption survives exactly, emoji and all");
});

test("null and undefined become empty fields, not the strings", () => {
  const csv = toCsv(["url", "author"], [[null, undefined]]);
  assert.equal(parseCsv(csv)[1].join("|"), "|");
});

test("a value needing no quoting is left bare", () => {
  const csv = toCsv(["a"], [["plain"]]);
  assert.ok(csv.includes("\r\nplain\r\n"), "no gratuitous quotes");
});

test("the file starts with a BOM so Excel reads UTF-8 captions", () => {
  assert.ok(toCsv(["a"], [["é"]]).startsWith("﻿"));
});

test("a field that is only a comma is still one field", () => {
  const csv = toCsv(["a", "b"], [[",", "x"]]);
  assert.deepEqual(parseCsv(csv)[1], [",", "x"]);
});
