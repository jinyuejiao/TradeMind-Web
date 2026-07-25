/**
 * 主壳关键 JS 语法门禁：防止 ?v= 替换误吃引号导致 ui-main.js 整文件解析失败、
 * 页面停在 index-app 旧骨架（无极速开单、侧栏无法切换）。
 *
 * 用法：node scripts/check-shell-js.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const files = [
    'assets/js/ui-main.js',
    'assets/js/auth.js',
    'assets/js/rapid-order.js',
    'assets/js/shortage-fulfillment.js',
    'assets/js/main-app.js'
];

let failed = false;
for (const rel of files) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
        console.error('[check-shell-js] missing:', rel);
        failed = true;
        continue;
    }
    const text = fs.readFileSync(abs, 'utf8');
    // 单引号字符串含 ?v= 且行尾未闭合（常见于错误的版本号批量替换）
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*\/\//.test(line) || !/\?v=/.test(line)) continue;
        const singles = (line.match(/'/g) || []).length;
        if (singles % 2 === 1 && /'[^']*\?v=[^']*$/.test(line)) {
            console.error(`[check-shell-js] possible unclosed quote ${rel}:${i + 1}`);
            console.error('  ' + line.trim());
            failed = true;
        }
    }
    const r = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
    if (r.status !== 0) {
        console.error(`[check-shell-js] syntax error: ${rel}`);
        if (r.stderr) console.error(r.stderr);
        failed = true;
    } else {
        console.log('[check-shell-js] ok', rel);
    }
}

if (failed) {
    process.exit(1);
}
console.log('[check-shell-js] all passed');
