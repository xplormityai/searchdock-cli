import { run } from './cli.js';
run().then(code => { process.exitCode = code; }, () => { process.exitCode = 1; });
