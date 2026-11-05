// Reads and writes CSV and Excel (.xlsx) files in the browser, with no outside library.
// An .xlsx file is a zip archive of XML files, which is all this needs to handle.
const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;

export const xmlEscape = value => String(value ?? '')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[character]));
const xmlUnescape = value => String(value).replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (match, code) => {
  const named = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'" }[code.toLowerCase()];
  if (named) return named;
  const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
  return Number.isFinite(number) ? String.fromCodePoint(number) : match;
});

// CSV ------------------------------------------------------------------
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const count = mark => firstLine.split(mark).length - 1;
  const delimiter = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < clean.length; index++) {
    const character = clean[index];
    if (quoted) {
      if (character === '"' && clean[index + 1] === '"') { cell += '"'; index++; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell === '') quoted = true;
    else if (character === delimiter) { row.push(cell); cell = ''; }
    else if (character === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (character !== '\r') cell += character;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
// A cell starting with one of these would run as a formula when the file is opened in Excel.
const safeCsvText = text => /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
export function toCsv(rows) {
  const body = rows.map(row => row.map(value => {
    const text = typeof value === 'number' ? String(value) : safeCsvText(String(value ?? ''));
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\r\n');
  // The mark at the start tells Excel the file is UTF-8, so Hebrew displays correctly.
  return `﻿${body}\r\n`;
}
// Excel in Israel often saves CSV in the older Hebrew encoding rather than UTF-8.
export function decodeText(bytes) {
  try { return new TextDecoder('utf-8', { fatal:true }).decode(bytes); }
  catch { return new TextDecoder('windows-1255').decode(bytes); }
}

// Zip ------------------------------------------------------------------
const crcTable = Array.from({ length:256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zipStored(files) {
  const encoder = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  files.forEach(({ name, content }) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const header = (signature, extra) => {
      const buffer = new Uint8Array(extra);
      const view = new DataView(buffer.buffer);
      view.setUint32(0, signature, true);
      return { buffer, view };
    };
    const local = header(0x04034b50, 30);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint16(12, 0x5021, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, nameBytes.length, true);
    const entry = header(0x02014b50, 46);
    entry.view.setUint16(4, 20, true);
    entry.view.setUint16(6, 20, true);
    entry.view.setUint16(8, 0x0800, true);
    entry.view.setUint16(14, 0x5021, true);
    entry.view.setUint32(16, crc, true);
    entry.view.setUint32(20, data.length, true);
    entry.view.setUint32(24, data.length, true);
    entry.view.setUint16(28, nameBytes.length, true);
    entry.view.setUint32(42, offset, true);
    parts.push(local.buffer, nameBytes, data);
    central.push(entry.buffer, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const result = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  all.forEach(part => { result.set(part, position); position += part.length; });
  return result;
}
async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let index = bytes.length - 22; index >= 0 && index >= bytes.length - 66000; index--) {
    if (view.getUint32(index, true) === 0x06054b50) { end = index; break; }
  }
  if (end < 0) throw new Error('not-zip');
  const decoder = new TextDecoder();
  const files = new Map();
  let position = view.getUint32(end + 16, true);
  let total = 0;
  for (let entry = 0; entry < view.getUint16(end + 10, true); entry++) {
    if (view.getUint32(position, true) !== 0x02014b50) throw new Error('not-zip');
    const method = view.getUint16(position + 10, true);
    const compressed = view.getUint32(position + 20, true);
    const size = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const localOffset = view.getUint32(position + 42, true);
    const name = decoder.decode(bytes.subarray(position + 46, position + 46 + nameLength));
    total += size;
    if (total > MAX_UNZIPPED_BYTES) throw new Error('too-large');
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    files.set(name, { method, data:bytes.subarray(start, start + compressed) });
    position += 46 + nameLength + extraLength + commentLength;
  }
  return {
    has:name => files.has(name),
    async text(name) {
      const file = files.get(name);
      if (!file) return null;
      return decoder.decode(file.method === 0 ? file.data : await inflateRaw(file.data));
    }
  };
}

// Excel ----------------------------------------------------------------
const columnIndex = reference => {
  const letters = /^[A-Z]+/i.exec(reference || '')?.[0].toUpperCase() || 'A';
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
};
const columnName = index => {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return name;
};
const textsIn = xml => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(match => xmlUnescape(match[1])).join('');
const attribute = (attributes, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];

export async function readXlsx(bytes) {
  const zip = await unzip(bytes);
  const sharedXml = await zip.text('xl/sharedStrings.xml');
  const shared = sharedXml ? [...sharedXml.matchAll(/<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(match => {
    // Phonetic guides are hints and not part of the text.
    return textsIn(match[1].replace(/<(?:\w+:)?rPh[\s\S]*?<\/(?:\w+:)?rPh>/g, ''));
  }) : [];
  // The first sheet in workbook order is the first tab the person sees.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbook = await zip.text('xl/workbook.xml');
  const relations = await zip.text('xl/_rels/workbook.xml.rels');
  const relationId = workbook && /<(?:\w+:)?sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  if (relationId && relations) {
    const relation = [...relations.matchAll(/<Relationship\b[^>]*>/g)].map(match => match[0]).find(tag => attribute(tag, 'Id') === relationId);
    const target = relation && attribute(relation, 'Target');
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  const sheet = await zip.text(sheetPath);
  if (sheet == null) throw new Error('no-sheet');
  const rows = [];
  for (const rowMatch of sheet.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const rowNumber = Number(attribute(rowMatch[1], 'r')) || rows.length + 1;
    const row = [];
    let next = 0;
    for (const cellMatch of (rowMatch[2] || '').matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const reference = attribute(cellMatch[1], 'r');
      const column = reference ? columnIndex(reference) : next;
      next = column + 1;
      const type = attribute(cellMatch[1], 't');
      const content = cellMatch[2] || '';
      const raw = /<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/.exec(content)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textsIn(content);
      else if (raw != null) value = xmlUnescape(raw);
      row[column] = value;
    }
    for (let column = 0; column < row.length; column++) if (row[column] === undefined) row[column] = '';
    while (rows.length < rowNumber - 1) rows.push([]);
    rows.push(row);
  }
  return rows;
}

export function writeXlsx(rows, sheetName = 'Sheet1') {
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnNumber) => {
    const reference = `${columnName(columnNumber)}${rowIndex + 1}`;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}"><v>${value}</v></c>`;
    return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const prolog = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zipStored([
    { name:'[Content_Types].xml', content:`${prolog}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name:'_rels/.rels', content:`${prolog}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name:'xl/workbook.xml', content:`${prolog}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name:'xl/_rels/workbook.xml.rels', content:`${prolog}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name:'xl/worksheets/sheet1.xml', content:`${prolog}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetData>${sheetRows}</sheetData></worksheet>` }
  ]);
}

// Reads a chosen file by its type. Old .xls files use a different format this cannot read.
export async function readSpreadsheet(name, bytes) {
  const lower = String(name).toLowerCase();
  if (lower.endsWith('.xls')) throw new Error('old-excel');
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes);
  if (lower.endsWith('.xlsx')) throw new Error('not-zip');
  return parseCsv(decodeText(bytes));
}
