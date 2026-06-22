#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const root=process.cwd();const errors=[];const warnings=[];
function readJson(path){try{return JSON.parse(readFileSync(join(root,path),'utf8'));}catch(error){errors.push(`${path}: invalid or unreadable JSON (${error.message})`);}}
function requireFile(path){if(!existsSync(join(root,path))) errors.push(`${path}: required file missing`);}
// A local .env is required to run the apps; the gate must only fail when the
// file is actually tracked by git (committed/staged), not merely present on a
// developer's disk where it is gitignored.
function isTrackedByGit(path){try{const out=execFileSync('git',['ls-files','--',path],{cwd:root,encoding:'utf8'});return out.trim().length>0;}catch{return existsSync(join(root,path));}}
const rootPkg=readJson('package.json');
if(rootPkg){for(const workspace of ['apps/*','packages/*','services/*']) if(!rootPkg.workspaces?.includes(workspace)) errors.push(`package.json: missing workspace ${workspace}`);for(const script of ['build:contracts','build:api','build:admin','build:provider','check:secrets','verify:workspace','verify:s0']) if(!rootPkg.scripts?.[script]) errors.push(`package.json: missing script ${script}`);if(!rootPkg.packageManager?.startsWith('npm@')) warnings.push('package.json: packageManager is not pinned to npm');}
for(const [path,name] of [['packages/contracts/package.json','@care-center/contracts'],['services/api/package.json','@care-center/api'],['apps/admin/package.json','@care-center/admin'],['apps/provider/package.json','@care-center/provider']]){const pkg=readJson(path);if(pkg?.name!==name) errors.push(`${path}: expected package name ${name}`);if(!pkg?.scripts?.build) errors.push(`${path}: missing build script`);}
for(const file of ['.env.example','services/api/.env.example','.github/workflows/ci.yml','scripts/s0/check-secrets.mjs','scripts/s0/smoke-api.mjs']) requireFile(file);
const rootEntries=new Set(readdirSync(root)); if(rootEntries.has('.env')&&isTrackedByGit('.env')) errors.push('root .env must not be committed'); if(isTrackedByGit('services/api/.env')) errors.push('services/api/.env must not be committed');
if(warnings.length){console.warn('S0 workspace warnings:');for(const w of warnings) console.warn(`- ${w}`);} if(errors.length){console.error('S0 workspace verification failed:');for(const e of errors) console.error(`- ${e}`);process.exit(1);} console.log('S0 workspace verification passed.');
