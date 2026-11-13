import {execFileSync} from "node:child_process";
import {existsSync,readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";

const sheet = /\.(?:xlsx|xlsm|xls|xlsb)$/i;
const index = execFileSync("git",["ls-files","--cached","--others","--exclude-standard","-z"],{encoding:"utf8"}).split("\0").filter(Boolean);
if (index.some(p=>sheet.test(p)||/(^|\/)\.env(?:$|\.(?!example$))/.test(p)||/(^|\/)(?:\.vercel|supabase\/\.(?:temp|branches))(?:\/|$)/.test(p))) {
  throw new Error("A private workbook, environment file or local deployment metadata is in the candidate Git source.");
}
const ignores=readFileSync(".vercelignore","utf8").split(/\r?\n/);
if (!["*.xlsx","*.xlsm","*.xls","*.xlsb",".env*",".vercel"].every(p=>ignores.includes(p))) {
  throw new Error("Private file exclusions are incomplete.");
}
function walk(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root,{withFileTypes:true}).flatMap(entry=>{
    const path=join(root,entry.name);
    return entry.isDirectory()?walk(path):[path];
  });
}
if (existsSync("public/brand") || existsSync("public/media")) throw new Error("Uncleared media directories must remain outside the Preview source.");
const publicFiles=walk("public");
const chunks=walk(".next/static");
if (!chunks.length) throw new Error("Build the application before auditing its client artifacts.");
for (const file of [...publicFiles,...chunks]) {
  if (sheet.test(file)) throw new Error("A workbook is present in public output.");
  if (!/\.(?:m?js|json|html|map)$/i.test(file)) continue;
  const data=readFileSync(file,"utf8");
  if (/sb_secret_[a-z0-9_-]{20,}/i.test(data)) throw new Error("A privileged key pattern was found in client output.");
  for (const match of data.matchAll(/eyJ[a-z0-9_-]+\.(eyJ[a-z0-9_-]+)\.[a-z0-9_-]+/gi)) {
    let role;
    try { role=JSON.parse(Buffer.from(match[1],"base64url").toString("utf8")).role; } catch { continue; }
    if (role==="service_role") throw new Error("A service-role JWT was found in client output.");
  }
}
console.log("Preview source and public build exclusions passed.");
