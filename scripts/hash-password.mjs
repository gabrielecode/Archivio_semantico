import crypto from 'crypto';
import readline from 'readline';

const args = process.argv.slice(2);

const hashPassword = (pw) => {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
    const stored = `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
    return stored;
};

if (args.length > 0) {
    console.warn('Warning: password in shell history');
    const hash = hashPassword(args[0]);
    console.log(hash);
    console.log(JSON.stringify({ id: 'username', name: 'Name', hash }));
} else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Password: ', (pw) => {
        const hash = hashPassword(pw);
        console.log(hash);
        console.log(JSON.stringify({ id: 'username', name: 'Name', hash }));
        rl.close();
    });
}
