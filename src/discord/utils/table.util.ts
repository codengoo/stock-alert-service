/**
 * Builds a monospace table (for Discord code-block) with column separators
 * and center-aligned cell values.
 *
 * @param headers - Column header labels
 * @param rows    - 2-D array of cell strings (same column count as headers)
 * @returns       Multi-line string ready to be wrapped in ``` ``` ```
 */
export function buildTable(headers: string[], rows: string[][]): string {
  const colCount = headers.length;

  // Compute column widths: max of header length and any cell length, min 3
  const widths = headers.map((h, i) =>
    Math.max(
      h.length,
      ...rows.map((r) => (r[i] ?? '').length),
      3,
    ),
  );

  const centerPad = (s: string, w: number): string => {
    const total = w - s.length;
    const left = Math.floor(total / 2);
    const right = total - left;
    return ' '.repeat(left) + s + ' '.repeat(right);
  };

  const buildRow = (cells: string[]): string =>
    '| ' +
    cells.map((c, i) => centerPad(c, widths[i])).join(' | ') +
    ' |';

  const separator =
    '|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|';

  const lines: string[] = [
    buildRow(headers),
    separator,
    ...rows.map(buildRow),
  ];

  return lines.join('\n');
}
