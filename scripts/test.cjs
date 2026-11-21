const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const output = mkdtempSync(join(tmpdir(),"7math-tests-"));
try {
  execFileSync(process.execPath,[require.resolve("typescript/bin/tsc"),"tests/curriculum.test.ts","tests/mentalist.test.ts","--target","ES2022","--module","commonjs","--moduleResolution","node","--resolveJsonModule","--esModuleInterop","--strict","--skipLibCheck","--outDir",output],{stdio:"inherit"});
  execFileSync(process.execPath,["--test",join(output,"tests/curriculum.test.js"),join(output,"tests/mentalist.test.js")],{stdio:"inherit"});
} catch (error) { process.exitCode=error.status || 1; }
finally { rmSync(output,{recursive:true,force:true}); }
