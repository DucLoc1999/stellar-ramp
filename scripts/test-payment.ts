import 'dotenv/config';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const WORKER_AUTH_TOKEN = process.env.WORKER_AUTH_TOKEN || 'Ms/U1IhNyj7L7VIjDPL1r6nPwJGlFMXiXcPnRpQ5vG2S';

const RECIPIENT = 'GABQEQMD4XALCSMHHMUBXHSXQPWOV47WMF5F4UCUZFR7DRD37OSX7SDH';
const AMOUNT = '1.0';
const ASSET_CODE = 'USDC';
const ASSET_ISSUER = process.env.TOKEN_ADDRESS || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const NETWORK = (process.env.STELLAR_NETWORK || 'testnet').toUpperCase();

const HORIZON_URL = NETWORK === 'TESTNET'
  ? 'https://horizon-testnet.stellar.org'
  : 'https://horizon.stellar.org';

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getUsdcBalance(publicKey: string): Promise<string> {
  const res = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
  if (!res.ok) throw new Error(`Failed to fetch account: ${res.statusText}`);
  const account = await res.json() as { balances: Array<{ asset_code?: string; asset_issuer?: string; balance: string }> };
  const balance = account.balances.find(
    (b) => b.asset_code === ASSET_CODE && b.asset_issuer === (TOKEN_ADDRESS || ASSET_ISSUER)
  );
  return balance ? balance.balance : '0';
}

async function pollTx(hash: string, maxAttempts = 3, delayMs = 3000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(delayMs);
    const res = await fetch(`${HORIZON_URL}/transactions/${hash}`);
    if (res.ok) {
      console.log(`[Tx Polling] Attempt ${i + 1}: Tx ${hash} found on chain`);
      return true;
    }
    console.log(`[Tx Polling] Attempt ${i + 1}/${maxAttempts}: Tx not found, retrying...`);
  }
  return false;
}

async function main() {
  console.log('=== Worker Transfer Test ===');

  // 1. Check balance before
  console.log('\n[1/4] Checking balance before transfer...');
  const balanceBefore = await getUsdcBalance(RECIPIENT);
  console.log(`Balance before: ${balanceBefore} ${ASSET_CODE}`);

  // 2. Call worker to transfer
  console.log('\n[2/4] Calling worker to execute transfer...');
  const workerRes = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WORKER_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      destination: RECIPIENT,
      amount: AMOUNT,
      memo: 'test-transfer',
      network: NETWORK,
      token_code: ASSET_CODE,
      token_address: TOKEN_ADDRESS,
    }),
  });

  if (!workerRes.ok) {
    const err = await workerRes.text();
    throw new Error(`Worker request failed: ${workerRes.status} ${err}`);
  }

  const workerData = await workerRes.json() as { success: boolean; hash?: string; error?: string };
  if (!workerData.success) {
    throw new Error(`Worker transfer failed: ${workerData.error}`);
  }

  const txHash = workerData.hash;
  console.log(`Transfer submitted. Tx hash: ${txHash}`);

  // 3. Poll tx status (wait 3s first, max 3 attempts)
  console.log('\n[3/4] Polling transaction status...');
  const txOnChain = await pollTx(txHash);
  if (!txOnChain) {
    throw new Error('Transaction not found on chain after 3 attempts');
  }

  // 4. Check balance after
  console.log('\n[4/4] Checking balance after transfer...');
  const balanceAfter = await getUsdcBalance(RECIPIENT);
  console.log(`Balance after: ${balanceAfter} ${ASSET_CODE}`);

  // Verify
  const before = parseFloat(balanceBefore);
  const after = parseFloat(balanceAfter);
  const expected = parseFloat(AMOUNT);
  const diff = after - before;

  console.log(`\n[Result] Diff: ${diff} ${ASSET_CODE}`);
  if (Math.abs(diff - expected) < 0.0000001) {
    console.log('✅ Transfer verified: Balance increased by correct amount');
  } else {
    console.error(`❌ Balance mismatch! Expected +${expected}, got +${diff}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});