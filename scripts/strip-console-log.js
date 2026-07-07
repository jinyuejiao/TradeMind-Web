#!/usr/bin/env node
/**
 * 移除运行时 JS/HTML 中的 console.log，保留 console.warn / console.error
 * 用法: node scripts/strip-console-log.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const TARGET_DIRS = [
  path.join(ROOT, 'assets', 'js'),
  path.join(ROOT, 'modules'),
  path.join(ROOT, 'MobileAdapt'),
];

function stripConsoleLog(content) {
  let result = '';
  let i = 0;
  while (i < content.length) {
    const idx = content.indexOf('console.log', i);
    if (idx === -1) {
      result += content.slice(i);
      break;
    }
    result += content.slice(i, idx);
    const open = content.indexOf('(', idx);
    if (open === -1) {
      result += content.slice(idx);
      break;
    }
    let depth = 0;
    let j = open;
    let inStr = false;
    let strChar = '';
    let escaped = false;
    for (; j < content.length; j++) {
      const ch = content[j];
      if (inStr) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === strChar) {
          inStr = false;
        }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = true;
        strChar = ch;
        continue;
      }
      if (ch === '(') depth++;
      if (ch === ')') {
        depth--;
        if (depth === 0) {
          j++;
          while (j < content.length && /[\s;]/.test(content[j])) j++;
          i = j;
          break;
        }
      }
    }
    if (depth !== 0) {
      result += content.slice(idx);
      break;
    }
  }
  return result.replace(/^\s*\n/gm, (m, offset, str) => {
    const before = str.slice(Math.max(0, offset - 1), offset);
    if (before === '\n') return m;
    return m;
  });
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(js|html|mjs)$/i.test(name)) files.push(full);
  }
  return files;
}

let totalRemoved = 0;
for (const dir of TARGET_DIRS) {
  for (const file of walk(dir)) {
    const before = fs.readFileSync(file, 'utf8');
    const beforeCount = (before.match(/console\.log\s*\(/g) || []).length;
    if (beforeCount === 0) continue;
    const after = stripConsoleLog(before);
    const afterCount = (after.match(/console\.log\s*\(/g) || []).length;
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      totalRemoved += beforeCount - afterCount;
      console.log(`[strip] ${path.relative(ROOT, file)}: removed ${beforeCount - afterCount} console.log`);
    }
  }
}
console.log(`Done. Total console.log removed: ${totalRemoved}`);
