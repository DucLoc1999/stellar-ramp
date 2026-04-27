import 'dotenv/config';
import { parseArgs } from 'node:util';
import { encrypt } from '../src/services/encryptionService';
import db from '../src/db';

interface WalletArgs {
  name?: string;
  publicKey?: string;
  secret?: string;
  network?: string;
  isActive?: boolean;
  update?: boolean;
}

function validateStellarPublicKey(key: string): boolean {
  return typeof key === 'string' && key.length === 56 && key.startsWith('G');
}

function validateStellarSecret(secret: string): boolean {
  return typeof secret === 'string' && secret.length === 56 && secret.startsWith('S');
}

function validateName(name: string): boolean {
  return /^[a-zA-Z0-9_]{1,50}$/.test(name) && name.length > 0;
}

async function main() {
  const args = parseArgs({
    options: {
      name: { type: 'string', short: 'n' },
      'public-key': { type: 'string', short: 'p' },
      secret: { type: 'string', short: 's' },
      network: { type: 'string', short: 'd', default: 'testnet' },
      'is-active': { type: 'boolean', default: true },
      update: { type: 'boolean', short: 'u', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: false,
  });

  const raw = args.values;
  const opts: WalletArgs = {
    name: raw.name?.replace(/^=/, ''),
    publicKey: raw['public-key']?.replace(/^=/, ''),
    secret: raw.secret?.replace(/^=/, ''),
    network: raw.network,
    isActive: raw['is-active'],
    update: raw.update,
    help: raw.help,
  };

  if (opts.help) {
    console.log(`
Usage: npm run wallet:add -- [options]

Options:
  -n, --name        Wallet name (required)
  -p, --public-key  Stellar public key (required, starts with G)
  -s, --secret      Stellar secret key (required, starts with S)
  -d, --network     Network: testnet|public (default: testnet)
  --is-active       Set wallet active (default: true)
  -u, --update      Update existing wallet by name

Examples:
  # Add new wallet
  npm run wallet:add -- -n=my_wallet -p=GXXXXXX -s=SXXXXXX

  # Update existing wallet
  npm run wallet:add -- -n=my_wallet -p=GXXXXXX -s=SXXXXXX -u

  # Deactivate wallet
  npm run wallet:add -- -n=my_wallet --is-active=false -u
`);
    process.exit(0);
  }

  const missing: string[] = [];
  if (!opts.name) missing.push('--name');
  if (!opts.publicKey) missing.push('--public-key');
  if (!opts.secret) missing.push('--secret');

  if (missing.length > 0) {
    console.error(`Error: Missing required: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!validateName(opts.name!)) {
    console.error('Error: name must be 1-50 chars, alphanumeric + underscore');
    process.exit(1);
  }

  if (!validateStellarPublicKey(opts.publicKey!)) {
    console.error('Error: public-key must be 56 chars, starting with G');
    process.exit(1);
  }

  if (!validateStellarSecret(opts.secret!)) {
    console.error('Error: secret must be 56 chars, starting with S');
    process.exit(1);
  }

  if (opts.network !== 'testnet' && opts.network !== 'public') {
    console.error('Error: network must be testnet or public');
    process.exit(1);
  }

  const encryptionKey = process.env.STELLAR_HOT_WALLET_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('Error: STELLAR_HOT_WALLET_ENCRYPTION_KEY env var not set');
    process.exit(1);
  }

  const encrypted = encrypt(opts.secret!);

  const existing = await db('system_wallets').where({ name: opts.name }).first();

  if (existing) {
    if (!opts.update) {
      console.error(`Error: Wallet '${opts.name}' already exists. Use --update to update.`);
      process.exit(1);
    }

    const updates: Record<string, unknown> = {
      public_key: opts.publicKey,
      network: opts.network,
      is_active: opts.isActive,
      updated_at: new Date(),
    };

    if (opts.secret) {
      updates.encrypted_secret = encrypted;
    }

    await db('system_wallets').where({ name: opts.name }).update(updates);

    if (opts.isActive) {
      await db('system_wallets')
        .whereNot({ name: opts.name })
        .where({ network: opts.network, is_active: true })
        .update({ is_active: false });
    }

    console.log(`Updated wallet '${opts.name}'`);
    console.log(`  public_key: ${opts.publicKey}`);
    console.log(`  network: ${opts.network}`);
    console.log(`  is_active: ${opts.isActive}`);
  } else {
    if (opts.update) {
      console.error(`Error: Wallet '${opts.name}' not found. Omit --update to create new.`);
      process.exit(1);
    }

    await db('system_wallets').insert({
      name: opts.name,
      public_key: opts.publicKey,
      encrypted_secret: encrypted,
      network: opts.network,
      is_active: opts.isActive,
      created_at: new Date(),
      updated_at: new Date(),
    });

    if (opts.isActive) {
      await db('system_wallets')
        .whereNot({ name: opts.name })
        .where({ network: opts.network, is_active: true })
        .update({ is_active: false });
    }

    console.log(`Created wallet '${opts.name}'`);
    console.log(`  public_key: ${opts.publicKey}`);
    console.log(`  network: ${opts.network}`);
    console.log(`  is_active: ${opts.isActive}`);
  }

  await db.destroy();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});