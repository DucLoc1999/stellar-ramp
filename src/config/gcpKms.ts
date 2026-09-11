export interface GcpKmsConfig {
  projectId: string;
  locationId: string;
  keyRing: string;
  keyId: string;
  keyVersion: string;
}

export function loadGcpKmsConfig(env: NodeJS.ProcessEnv = process.env): GcpKmsConfig {
  const required: Record<Exclude<keyof GcpKmsConfig, 'keyVersion'>, string | undefined> = {
    projectId: env.GCP_KMS_PROJECT_ID,
    locationId: env.GCP_KMS_LOCATION_ID,
    keyRing: env.GCP_KMS_KEY_RING,
    keyId: env.GCP_KMS_KEY_ID,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase());

  if (missing.length > 0) {
    throw new Error(`Missing GCP KMS configuration: ${missing.join(', ')}`);
  }

  return {
    ...(required as Record<keyof typeof required, string>),
    keyVersion: env.GCP_KMS_KEY_VERSION || '1',
  };
}
