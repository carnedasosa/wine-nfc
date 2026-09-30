const fs = require('node:fs');
const escape = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const inline = text => escape(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
const lines = fs.readFileSync('docs/STATO_RELEASE_SOVRANATURALE.md','utf8').split(/\r?\n/);
const output = [];
for (let i=0; i<lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  const heading = line.match(/^(#{1,3}) (.*)$/);
  if (heading) { output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
  if (line.startsWith('|')) {
    const rows=[];
    while (i<lines.length && lines[i].startsWith('|')) {
      if (!/^\|[-| :]+\|$/.test(lines[i])) rows.push(lines[i].split('|').slice(1,-1).map(c=>c.trim()));
      i++;
    }
    i--;
    output.push('<div class="table-scroll"><table>'+rows.map((row,n)=>'<tr>'+row.map(cell=>n===0?'<th>'+inline(cell)+'</th>':'<td>'+inline(cell)+'</td>').join('')+'</tr>').join('')+'</table></div>');
    continue;
  }
  if (/^(?:- |\d+\. )/.test(line)) {
    const ordered=/^\d/.test(line),tag=ordered?'ol':'ul',items=[];
    while(i<lines.length && (ordered?/^\d+\. /:/^- /).test(lines[i])) { items.push('<li>'+inline(lines[i].replace(/^(?:- |\d+\. )/,''))+'</li>'); i++; }
    i--; output.push('<'+tag+'>'+items.join('')+'</'+tag+'>'); continue;
  }
  output.push('<p>'+inline(line)+'</p>');
}
fs.writeFileSync('docs/STATO_RELEASE_SOVRANATURALE.html',`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sovranaturale — stato della release</title><style>
:root{color-scheme:light}body{margin:0;background:#f5f2e9;color:#232b27;font:17px/1.65 system-ui,sans-serif}main{max-width:1040px;margin:0 auto;padding:48px 28px 80px}h1{font:700 clamp(30px,5vw,49px)/1.1 Georgia,serif;color:#253f32;margin:16px 0 28px}h2{font-size:25px;color:#253f32;margin:44px 0 18px;border-top:1px solid #cbd1c9;padding-top:25px}p{margin:15px 0}a{color:#275e48;text-underline-offset:3px}code{font-size:.88em;background:#e8e6de;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:15px;background:#fffdf7}th{background:#253f32;color:#fff;text-align:left}td,th{padding:15px;border:1px solid #d5dbd1;vertical-align:top}td:first-child{font-weight:650;min-width:125px}li{margin:12px 0}strong{font-weight:750}.eyebrow{font-size:13px;letter-spacing:.13em;text-transform:uppercase;color:#5c6a5e}.status{background:#fae6ad;border-left:5px solid #a56b00;padding:20px 24px;margin:24px 0;font-weight:650}@media print{body{background:white;font-size:11pt}main{padding:0}h2{break-after:avoid}tr{break-inside:avoid}.table-scroll{overflow:visible}a{color:inherit}}
</style></head><body><main><div class="eyebrow">Wine NFC · rilascio del 25 ottobre 2026</div><div class="status">Codice corretto e collaudato. Apertura al pubblico ancora subordinata ai servizi e alle prove di produzione.</div>${output.join('\n')}</main></body></html>`);
console.log('Report HTML aggiornato.');
