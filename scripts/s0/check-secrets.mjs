#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
const root = process.cwd();
const skipDirs = new Set(['.git','node_modules','.next','dist','build','.dart_tool','.gradle','Pods','coverage','.venv','venv','__pycache__','.pytest_cache','.mypy_cache','.ruff_cache']);
const binaryExt = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.docx','.lockb']);
const allowedEnvExamples = new Set(['.env.example','services/api/.env.example','deploy/dokploy/.env.example']);
const leakedValuePatterns = [/wave1-[A-Za-z0-9-]+/i,/postgres\.[a-z0-9]{20,}/i,/postgresql:\/\/[^\s:@]+:[^\s@]+@aws-[^\s]+supabase\.com/i,/postgresql:\/\/[^\s:@]+:[^\s@]+@[^\s/]+\/careointhsp/i,/MEDICAL_PROFILE_ENCRYPTION_KEY[ \t]*=[ \t]*(?!change-me|$)[^\r\n]{16,}/i,/JWT_ACCESS_SECRET[ \t]*=[ \t]*(?!change-me|replace-|local-|$)[^\r\n]{16,}/i,/JWT_REFRESH_SECRET[ \t]*=[ \t]*(?!change-me|replace-|local-|$)[^\r\n]{16,}/i,/TWILIO_AUTH_TOKEN[ \t]*=[ \t]*[^\r\n]{16,}/i,/STRIPE_SECRET_KEY[ \t]*=[ \t]*sk_(live|test)_[A-Za-z0-9]+/i];
const forbiddenFilePatterns = [/(^|\/)\.env$/,/((^|\/)\.env\.(local|production|staging|development|test))$/,/\.pem$/i,/\.p12$/i,/\.pfx$/i,/\.key$/i,/\.zip$/i,/\.old$/i,/ - Copy\./i,/(^|\/)\.data\//i,/(^|\/)\.runtime\//i,/^services\/api\/data\/.*\.json$/i];
const findings=[];

// Enumerate files via git so the gate respects .gitignore: it scans tracked
// files plus untracked-but-not-ignored files. This catches anything committed
// or stageable while ignoring developer-local artifacts (.env, .venv, runtime
// data) that are gitignored and never reach the repository.
function gitFileList(){
  try{
    const out=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
    const files=out.split('\0').map(f=>f.trim()).filter(Boolean);
    return files.length?files:null;
  }catch{
    return null;
  }
}

function walk(dir,acc){for(const entry of readdirSync(dir)){const abs=join(dir,entry);const st=statSync(abs);if(st.isDirectory()){if(!skipDirs.has(entry)) walk(abs,acc);continue;}if(st.isFile()) acc.push(relative(root,abs).replaceAll('\\','/'));}return acc;}

const files = gitFileList() ?? walk(root,[]);
for(const rel of files){
  if(forbiddenFilePatterns.some(p=>p.test(rel))&&!allowedEnvExamples.has(rel)) findings.push({file:rel,issue:'forbidden repository artifact or secret file'});
  if(rel==='scripts/s0/check-secrets.mjs') continue;
  const ext=rel.includes('.')?rel.slice(rel.lastIndexOf('.')).toLowerCase():'';
  if(binaryExt.has(ext)) continue;
  let text='';
  try{text=readFileSync(join(root,rel),'utf8');}catch{continue;}
  for(const pattern of leakedValuePatterns){const match=text.match(pattern);if(match) findings.push({file:rel,issue:`possible leaked secret: ${match[0].slice(0,80)}`});}
}

if(findings.length){console.error('S0 secret/artifact check failed. Findings:');for(const item of findings) console.error(`- ${item.file}: ${item.issue}`);process.exit(1);}console.log('S0 secret/artifact check passed: no committed .env, leaked S0 credentials, zip, .old or copy artifacts detected.');
