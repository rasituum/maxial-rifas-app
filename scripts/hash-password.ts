import { hashPassword } from '../dist/password.js';
let password = '';
for await (const chunk of process.stdin) password += chunk.toString();
password = password.replace(/\r?\n$/, '');
if (!password || password.length > 1024) {
  console.error('Provide a password of 1–1024 characters on standard input.');
  process.exitCode = 1;
} else console.log(await hashPassword(password));
