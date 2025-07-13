// build.ts
import { execSync } from 'child_process';

// Compile TypeScript files to dist/
execSync('tsc --outDir dist', { stdio: 'inherit' });
