// Prints a scrypt hash for DESK_PASSWORD_HASH. Usage: npm run hash-password -- "your password"
import { hashPassword } from "../src/auth.js";

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: npm run hash-password -- "a password of at least 8 characters"');
  process.exit(1);
}
console.log(hashPassword(password));
