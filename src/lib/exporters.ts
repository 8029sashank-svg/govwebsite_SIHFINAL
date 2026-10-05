/**
 * exporters.ts
 * ------------
 * Client-side report generation. Everything runs in the browser so a
 * taluka office with intermittent connectivity can still produce a
 * report from cached data.
 *
 * CSV is a genuine download. "PDF" opens a print-styled document and
 * invokes the browser's print dialog, where the operator chooses
 * "Save as PDF" — this is the simulation the brief asks for, and it is
 * also how most government portals actually produce PDFs without a
 * server-side renderer. For a true server-generated PDF (with a digital
 * signature block), post the same rows to a Puppeteer or WeasyPrint
 * service.
 */

export interface ReportMeta {
  title: string;
  scope: string;
  period: string;
  generatedBy: string;
  generatedAt: string;
  summary?: string;
}

export type Row = Array<string | number>;

function escapeCsv(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Row[], meta: ReportMeta): string {
  const header = [
    `# ${meta.title}`,
    `# Scope: ${meta.scope}`,
    `# Period: ${meta.period}`,
    `# Generated: ${meta.generatedAt} by ${meta.generatedBy}`,
    meta.summary ? `# Summary: ${meta.summary}` : '',
    '',
  ]
    .filter(Boolean)
    .join('\n');

  const body = [columns, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

export function downloadCsv(filename: string, columns: string[], rows: Row[], meta: ReportMeta): void {
  const blob = new Blob([toCsv(columns, rows, meta)], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens a print-ready, government-letterhead rendering of a table. */
export function printReport(columns: string[], rows: Row[], meta: ReportMeta): void {
  const win = window.open('', '_blank', 'width=1024,height=768');
  if (!win) {
    // Pop-up blocked — the caller should surface this to the operator.
    throw new Error('Unable to open the print window. Allow pop-ups for this site and try again.');
  }

  const escapeHtml = (value: string | number) =>
    String(value ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
    );

  win.document.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(meta.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 32px; }
  .rule { height: 4px; background: linear-gradient(90deg,#ff9933 33%,#fff 33%,#fff 66%,#138808 66%); }
  header { border-bottom: 2px solid #071429; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { font-size: 16px; margin: 12px 0 2px; letter-spacing: .02em; }
  h2 { font-size: 13px; margin: 0 0 10px; font-weight: 600; color: #444; }
  .meta { font-size: 11px; color: #555; display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px 24px; }
  .summary { margin: 14px 0; font-size: 12px; background: #f4f6f9; border-left: 3px solid #ff9933; padding: 8px 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th { text-align: left; background: #071429; color: #fff; padding: 6px 8px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e3e7ee; }
  tr:nth-child(even) td { background: #fafbfd; }
  footer { margin-top: 24px; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
  .sign { margin-top: 42px; font-size: 11px; display: flex; justify-content: flex-end; }
  .sign div { width: 220px; border-top: 1px solid #333; padding-top: 4px; text-align: center; }
  @media print { body { margin: 14mm; } }
</style></head>
<body>
  <div class="rule"></div>
  <header>
    <h1>GOVERNMENT OF MAHARASHTRA — DEPARTMENT OF AGRICULTURE</h1>
    <h2>GeoFarm.gov · Agricultural Surveillance &amp; Health Management System</h2>
    <div class="meta">
      <span><strong>Report:</strong> ${escapeHtml(meta.title)}</span>
      <span><strong>Scope:</strong> ${escapeHtml(meta.scope)}</span>
      <span><strong>Period:</strong> ${escapeHtml(meta.period)}</span>
      <span><strong>Generated:</strong> ${escapeHtml(meta.generatedAt)}</span>
      <span><strong>Prepared by:</strong> ${escapeHtml(meta.generatedBy)}</span>
      <span><strong>Records:</strong> ${rows.length}</span>
    </div>
  </header>
  ${meta.summary ? `<div class="summary">${escapeHtml(meta.summary)}</div>` : ''}
  <table>
    <thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>${r.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
  <div class="sign"><div>Authorised Signatory</div></div>
  <footer>
    Generated from the GeoFarm.gov surveillance prototype. Figures are demonstration data and are not
    audited departmental statistics. This document is not valid without the signature of the authorised officer.
  </footer>
</body></html>`);

  win.document.close();
  win.focus();
  // Give the new document a tick to lay out before printing.
  setTimeout(() => win.print(), 350);
}
