const { execSync } = require('child_process');
const fs = require('fs');

console.log('Running npm test at repository root...');
try {
  const output = execSync('npm test', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  fs.writeFileSync('logs/scope-test.txt', output, 'utf8');
  console.log('npm test finished successfully and wrote logs/scope-test.txt');
} catch (error) {
  const combined = (error.stdout || '') + '\n' + (error.stderr || '');
  fs.writeFileSync('logs/scope-test.txt', combined, 'utf8');
  console.error('npm test failed with exit code:', error.status);
  process.exit(error.status || 1);
}
