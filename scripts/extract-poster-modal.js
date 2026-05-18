const fs = require('fs');
const uiPath = 'd:/项目/TradeMind/项目工程/UI/TradeMind/index.html';
const outPath = 'd:/项目/TradeMind/项目工程/TM_Project/TradeMind-Web/modules/fragments/poster-modal.html';
const ui = fs.readFileSync(uiPath, 'utf8');
const startIdx = ui.indexOf('<div id="poster-modal"');
if (startIdx < 0) throw new Error('poster-modal not found');
const endMarker = ui.indexOf('<!-- 2. 主工作区', startIdx);
let chunk = ui.slice(startIdx, endMarker).trim();
const lines = chunk.split('\n');
while (lines.length && !lines[lines.length - 1].trim().startsWith('</div>')) {
  lines.pop();
}
chunk = lines.join('\n');
chunk = chunk.replace(/TM-778201/g, '—');
chunk = chunk.replace(/tradmeind\.com\.cn/g, 'trademind.com.cn');
if (!chunk.includes('poster-landing-link')) {
  chunk = chunk.replace(
    /<p class="text-\[11px\] text-slate-500 leading-relaxed">\s*邀请好友开通/,
    '<p class="text-[11px] text-slate-500 leading-relaxed">邀请好友开通'
  );
  chunk = chunk.replace(
    '立享推荐返现</span>\n                    </p>',
    '立享推荐返现</span></p>\n                    <p class="text-[10px] text-slate-400 mt-2">或访问 <a id="poster-landing-link" href="https://trademind.com.cn/register.html" target="_blank" rel="noopener" class="text-teal-600 font-bold underline">trademind.com.cn</a></p>'
  );
}
chunk = chunk.replace(/<button onclick="closePoster\(\)"/g, '<button type="button" onclick="closePoster()"');
chunk = chunk.replace(/<button onclick="downloadPoster\(\)"/g, '<button type="button" onclick="downloadPoster()"');
fs.writeFileSync(outPath, chunk + '\n');
console.log('OK bytes', chunk.length);
