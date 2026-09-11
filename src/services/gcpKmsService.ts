import crypto from 'crypto';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { StrKey } from '@stellar/stellar-sdk';
import { loadGcpKmsConfig } from '../config/gcpKms';

const SIGN_RETRY_COUNT = 2;
const SIGN_RETRY_DELAY_MS = 200;

export class KmsSigningError extends Error {
  code: 'KMS_AUTH_ERROR' | 'KMS_SIGNING_ERROR';

  constructor(message: string, code: 'KMS_AUTH_ERROR' | 'KMS_SIGNING_ERROR') {
    super(message);
    this.name = 'KmsSigningError';
    this.code = code;
  }
}

let client: KeyManagementServiceClient | null = null;

function getClient(): KeyManagementServiceClient {
  if (!client) {
    client = new KeyManagementServiceClient();
  }
  return client;
}

export function keyVersionPath(): string {
  const config = loadGcpKmsConfig();
  return getClient().cryptoKeyVersionPath(
    config.projectId,
    config.locationId,
    config.keyRing,
    config.keyId,
    config.keyVersion
  );
}

function classifyError(error: unknown): KmsSigningError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (
    lower.includes('default credentials') ||
    lower.includes('could not load') ||
    lower.includes('unauthenticated') ||
    lower.includes('permission denied') ||
    lower.includes('forbidden')
  ) {
    return new KmsSigningError(message, 'KMS_AUTH_ERROR');
  }
  return new KmsSigningError(message, 'KMS_SIGNING_ERROR');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function signTxHash(txHash: Buffer): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SIGN_RETRY_COUNT; attempt += 1) {
    try {
      const [response] = await getClient().asymmetricSign({
        name: keyVersionPath(),
        data: txHash,
      });
      if (!response.signature) {
        throw new Error('KMS returned an empty signature');
      }
      return Buffer.from(response.signature);
    } catch (error) {
      lastError = error;
      if (attempt < SIGN_RETRY_COUNT) {
        await sleep(SIGN_RETRY_DELAY_MS);
      }
    }
  }
  throw classifyError(lastError);
}

export function parseEd25519PublicKeyPem(pem: string): Buffer {
  const der = crypto.createPublicKey(pem).export({ type: 'spki', format: 'der' }) as Buffer;
  const raw = der.subarray(der.length - 32);
  if (raw.length !== 32) {
    throw new Error('Unexpected Ed25519 SPKI length');
  }
  return raw;
}

// Public address cache keyed by the KMS key-version path: changing
// GCP_KMS_KEY_VERSION at runtime resolves a new address automatically.
const publicKeyCache = new Map<string, string>();

export async function getStellarPublicKey(): Promise<string> {
  const path = keyVersionPath();
  const cached = publicKeyCache.get(path);
  if (cached) {
    return cached;
  }
  const [publicKey] = await getClient().getPublicKey({ name: path });
  if (!publicKey.pem) {
    throw new Error('KMS returned no public key');
  }
  const raw = parseEd25519PublicKeyPem(publicKey.pem);
  const address = StrKey.encodeEd25519PublicKey(raw);
  publicKeyCache.set(path, address);
  return address;
}

export function resetPublicKeyCache(): void {
  publicKeyCache.clear();
}

/** Hot-wallet address unified from the GCP KMS key-version config. */
export function getHotWalletAddress(): Promise<string> {
  return resolveSourcePublicKey();
}

export async function resolveSourcePublicKey(): Promise<string> {
  return getStellarPublicKey();
}