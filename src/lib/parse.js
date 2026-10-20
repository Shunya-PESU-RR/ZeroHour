// Parsers for uploaded txt/csv files.

const lines = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

// One name per line.
export function parseNames(text) {
  const items = lines(text).map((name, i) => ({ id: 'm' + Date.now() + i, name }));
  return items.length ? { items } : { error: 'No names found. Put one name per line.' };
}

// "Team name"  or  "12, Team name"  (table number optional)
export function parseTeams(text) {
  let rows = lines(text);
  if (rows.length && /^(table\s*,\s*)?team(\s*name)?s?$/i.test(rows[0])) {
    rows = rows.slice(1); // skip header row
  }
  const items = rows.map((line, i) => {
    const m = line.match(/^(\d+)\s*[,\t]\s*(.+)$/);
    return { id: 't' + Date.now() + i, name: (m ? m[2] : line).replace(/^"|"$/g, ''), table: m ? Number(m[1]) : i + 1 };
  });
  return items.length ? { items } : { error: 'No teams found. Put one team per line.' };
}

// "Criterion name, weight"  (weights can be percentages or any numbers, they get normalised)
export function parseCriteria(text) {
  let rows = lines(text);
  const parsed = [];
  for (let i = 0; i < rows.length; i++) {
    const cut = rows[i].lastIndexOf(',');
    const label = cut > 0 ? rows[i].slice(0, cut).trim().replace(/^"|"$/g, '') : '';
    const weight = cut > 0 ? parseFloat(rows[i].slice(cut + 1)) : NaN;
    if (!label || !(weight > 0)) {
      if (i === 0) continue; // likely a header row
      return { error: 'Line ' + (i + 1) + ' should look like: Criterion name, weight' };
    }
    parsed.push({ label, weight });
  }
  if (!parsed.length) return { error: 'No criteria found. Use one per line: Criterion name, weight' };
  const sum = parsed.reduce((s, c) => s + c.weight, 0);
  const items = parsed.map((c, i) => ({
    id: c.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + i,
    label: c.label,
    weight: c.weight / sum,
  }));
  return { items };
}
