/**
 * Migrate MUI v5 Grid2 breakpoint props to v6 size={{...}} format.
 * v5: <Grid xs={12} md={6}>
 * v6: <Grid size={{ xs: 12, md: 6 }}>
 * Also removes deprecated `item` prop.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl'];
const SRC_DIR = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function findTsxFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) findTsxFiles(p, out);
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Scan content and find the end index of a JSX opening tag starting at `start` */
function findTagEnd(content, start) {
  let depth = 0;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
    else if (content[i] === '>' && depth === 0) return i + 1;
  }
  return -1;
}

/** Transform a single Grid opening tag string */
function transformTag(tag) {
  const bpValues = {};

  // Extract breakpoint prop values (they're always simple numbers)
  for (const bp of BREAKPOINTS) {
    const re = new RegExp(`(?<=\\s)${bp}=\\{(\\d+)\\}`);
    const m = tag.match(re);
    if (m) {
      bpValues[bp] = m[1];
      // Remove the breakpoint prop (plus preceding whitespace)
      tag = tag.replace(new RegExp(`\\s+${bp}=\\{\\d+\\}`), '');
    }
  }

  // Remove `item` standalone prop (not part of identifiers like "gridItem")
  tag = tag.replace(/(\s+)item(?=\s|>)/, '$1');

  if (Object.keys(bpValues).length === 0) return tag;

  // Build size prop
  const parts = BREAKPOINTS.filter(bp => bp in bpValues).map(bp => `${bp}: ${bpValues[bp]}`);
  const sizeProp = `size={{ ${parts.join(', ')} }}`;

  // Insert size prop right after "<Grid" (before any other props/whitespace)
  tag = tag.replace(/^<Grid(\s|>)/, `<Grid ${sizeProp}$1`);

  // Collapse multiple consecutive spaces/newlines left from removed props (keep indentation)
  // Replace lines that became all-whitespace with nothing
  tag = tag.replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n');
  tag = tag.replace(/^(<Grid [^\n]*)\n\n/m, '$1\n');

  return tag;
}

function processFile(filePath) {
  const original = readFileSync(filePath, 'utf8');
  let result = '';
  let i = 0;
  let changed = false;

  while (i < original.length) {
    const gridIdx = original.indexOf('<Grid', i);
    if (gridIdx === -1) {
      result += original.slice(i);
      break;
    }

    // Verify it's a Grid component not GridSomething (e.g., GridItem custom comp)
    const charAfter = original[gridIdx + 5];
    if (charAfter !== ' ' && charAfter !== '\n' && charAfter !== '\r' && charAfter !== '>' && charAfter !== '\t') {
      result += original.slice(i, gridIdx + 5);
      i = gridIdx + 5;
      continue;
    }

    const tagEnd = findTagEnd(original, gridIdx);
    if (tagEnd === -1) {
      result += original.slice(i);
      break;
    }

    const tag = original.slice(gridIdx, tagEnd);
    const hasBp = BREAKPOINTS.some(bp => new RegExp(`(?<=\\s)${bp}=\\{\\d+\\}`).test(tag));
    const hasItem = /(\s)item(\s|>)/.test(tag);

    result += original.slice(i, gridIdx);

    if (hasBp || hasItem) {
      result += transformTag(tag);
      changed = true;
    } else {
      result += tag;
    }

    i = tagEnd;
  }

  if (changed) {
    writeFileSync(filePath, result, 'utf8');
  }
  return changed;
}

const files = findTsxFiles(SRC_DIR);
let total = 0;
for (const f of files) {
  if (processFile(f)) {
    total++;
    console.log('  ✓', f.replace(SRC_DIR, '').replace(/\\/g, '/'));
  }
}
console.log(`\nDone. ${total} files updated.`);
