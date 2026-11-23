const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const output = mkdtempSync(join(tmpdir(),"7math-tests-"));
try {
  const suites = ["curriculum", "mentalist", "courses", "survivor", "verification"];
  execFileSync(process.execPath,[require.resolve("typescript/bin/tsc"),...suites.map(name => `tests/${name}.test.ts`),"--target","ES2022","--module","commonjs","--moduleResolution","node","--resolveJsonModule","--esModuleInterop","--strict","--skipLibCheck","--outDir",output],{stdio:"inherit"});
  execFileSync(process.execPath,["--test",...suites.map(name => join(output,"tests",`${name}.test.js`))],{stdio:"inherit"});
} catch (error) { process.exitCode=error.status || 1; }
finally { rmSync(output,{recursive:true,force:true}); }
