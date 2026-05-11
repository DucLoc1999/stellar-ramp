import * as StellarSdk from 'stellar-sdk';

export interface Env {
  STELLAR_PRIVATE_KEY: string;
  INTERNAL_AUTH_TOKEN: string;
}

type PaymentRequestBody = {
  destination?: unknown;
  amount?: unknown;
  memo?: unknown;
  network?: unknown;
  token_address?: unknown;
  token_code?: unknown;
};

type AssetSpec =
  | {
    isNative: true;
    asset: StellarSdk.Asset;
    assetCode: 'XLM';
    assetIssuer?: undefined;
  }
  | {
    isNative: false;
    asset: StellarSdk.Asset;
    assetCode: string;
    assetIssuer: string;
  };

type ParsedRequest = {
  destination: string;
  amount: string;
  memo?: string;
  network: 'TESTNET' | 'PUBLIC';
  asset: AssetSpec;
};

type HorizonServer = InstanceType<typeof StellarSdk.Horizon.Server>;
type HorizonAccount = Awaited<ReturnType<HorizonServer['loadAccount']>>;

const STROOP_SCALE = 10n ** 7n;
const MIN_XLM_BALANCE = '0.00001';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function assertBearerToken(authHeader: string | null, expectedToken: string): boolean {
  if (!authHeader) {
    return false;
  }

  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) {
    return false;
  }

  const token = authHeader.slice(prefix.length).trim();
  return token.length > 0 && token === expectedToken;
}

function isValidNetwork(value: string): value is 'TESTNET' | 'PUBLIC' {
  return value === 'TESTNET' || value === 'PUBLIC' || value === 'MAINNET';
}

function normalizeNetwork(value: string): 'TESTNET' | 'PUBLIC' {
  return value === 'PUBLIC' || value === 'MAINNET' ? 'PUBLIC' : 'TESTNET';
}

function getNetworkConfig(networkValue: string) {
  const normalized = normalizeNetwork(networkValue.trim().toUpperCase());

  if (normalized === 'PUBLIC') {
    return {
      serverUrl: 'https://horizon.stellar.org',
      networkPassphrase: StellarSdk.Networks.PUBLIC,
    };
  }

  return {
    serverUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: StellarSdk.Networks.TESTNET,
  };
}

function toStroops(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(amount);
  if (!match) {
    throw new Error('amount must have no more than 7 decimal places');
  }

  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(7, '0');
  return whole * STROOP_SCALE + BigInt(fraction || '0');
}

function parseAssetCode(raw: unknown): string {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : 'USDC';

  if (!/^[A-Z0-9]{1,12}$/.test(code)) {
    throw new Error('token_code must be 1-12 alphanumeric characters');
  }

  return code;
}

function parsePaymentRequest(body: PaymentRequestBody): ParsedRequest {
  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
  const amount = typeof body.amount === 'string' ? body.amount.trim() : '';
  const memo = typeof body.memo === 'string' ? body.memo.trim() : undefined;
  const networkRaw = typeof body.network === 'string' ? body.network.trim().toUpperCase() : '';
  const tokenAddress = typeof body.token_address === 'string' ? body.token_address.trim() : '';
  const encoder = new TextEncoder();

  if (!destination) {
    throw new Error('destination is required');
  }

  if (!StellarSdk.StrKey.isValidEd25519PublicKey(destination)) {
    throw new Error('destination must be a valid Stellar public key');
  }

  if (!amount) {
    throw new Error('amount is required');
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('amount must be a positive number');
  }

  toStroops(amount);

  if (memo && encoder.encode(memo).length > 28) {
    throw new Error('memo must be 28 bytes or fewer');
  }

  if (!networkRaw) {
    throw new Error('network is required');
  }

  if (!isValidNetwork(networkRaw)) {
    throw new Error('network must be TESTNET or PUBLIC');
  }

  if (tokenAddress && !StellarSdk.StrKey.isValidEd25519PublicKey(tokenAddress)) {
    throw new Error('token_address must be a valid Stellar public key');
  }

  if (tokenAddress) {
    const tokenCode = parseAssetCode(body.token_code);
    return {
      destination,
      amount,
      memo,
      network: normalizeNetwork(networkRaw),
      asset: {
        isNative: false,
        asset: new StellarSdk.Asset(tokenCode, tokenAddress),
        assetCode: tokenCode,
        assetIssuer: tokenAddress,
      },
    };
  }

  return {
    destination,
    amount,
    memo,
    network: normalizeNetwork(networkRaw),
    asset: {
      isNative: true,
      asset: StellarSdk.Asset.native(),
      assetCode: 'XLM',
    },
  };
}

function findNativeBalance(account: HorizonAccount): string {
  const nativeBalance = account.balances.find((b) => b.asset_type === 'native');
  return nativeBalance ? nativeBalance.balance : '0';
}

function findTokenBalance(account: HorizonAccount, assetCode: string, assetIssuer: string): { balance: string; isAuthorized: boolean } | null {
  const trustline = account.balances.find((b) => {
    return (
      typeof b !== 'string' &&
      'asset_code' in b &&
      'asset_issuer' in b &&
      b.asset_code === assetCode &&
      b.asset_issuer === assetIssuer
    );
  });

  if (!trustline) return null;
  const balanceLine = trustline as { is_authorized?: boolean };
  return {
    balance: trustline.balance,
    isAuthorized: Boolean(balanceLine.is_authorized ?? true),
  };
}

async function checkSourceWallet(
  server: HorizonServer,
  sourceAccount: HorizonAccount,
  asset: AssetSpec,
  paymentAmount: string
): Promise<Response | null> {
  const xlmBalance = parseFloat(findNativeBalance(sourceAccount));
  if (xlmBalance < parseFloat(MIN_XLM_BALANCE)) {
    return jsonResponse(
      { success: false, error: `INSUFFICIENT_GAS: XLM balance ${xlmBalance} below minimum ${MIN_XLM_BALANCE}` },
      { status: 400 }
    );
  }

  if (!asset.isNative) {
    const sourceBalance = findTokenBalance(sourceAccount, asset.assetCode, asset.assetIssuer);

    if (!sourceBalance) {
      return jsonResponse(
        { success: false, error: 'WALLET_NO_TRUSTLINE: Source wallet missing trustline for token' },
        { status: 400 }
      );
    }

    if (!sourceBalance.isAuthorized) {
      return jsonResponse(
        { success: false, error: 'WALLET_NOT_AUTHORIZED: Source trustline is frozen' },
        { status: 400 }
      );
    }

    const tokenBalanceNum = parseFloat(sourceBalance.balance);
    const paymentAmountNum = parseFloat(paymentAmount);
    if (tokenBalanceNum < paymentAmountNum) {
      return jsonResponse(
        { success: false, error: `INSUFFICIENT_TOKEN_BALANCE: Available ${tokenBalanceNum}, required ${paymentAmountNum}` },
        { status: 400 }
      );
    }
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'POST' },
      });
    }

    if (!assertBearerToken(request.headers.get('Authorization'), env.INTERNAL_AUTH_TOKEN)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    if (!env.STELLAR_PRIVATE_KEY) {
      return jsonResponse({ success: false, error: 'Missing STELLAR_PRIVATE_KEY' }, { status: 500 });
    }

    try {
      let body: PaymentRequestBody;
      try {
        body = (await request.json()) as PaymentRequestBody;
      } catch {
        return jsonResponse({ success: false, error: 'Invalid JSON body' }, { status: 400 });
      }

      let parsed: ParsedRequest;
      try {
        parsed = parsePaymentRequest(body);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid request body';
        return jsonResponse({ success: false, error: message }, { status: 400 });
      }

      const { serverUrl, networkPassphrase } = getNetworkConfig(parsed.network);
      const server = new StellarSdk.Horizon.Server(serverUrl);
      const sourceKeypair = StellarSdk.Keypair.fromSecret(env.STELLAR_PRIVATE_KEY);
      const sourcePublicKey = sourceKeypair.publicKey();
      const sourceAccount = await server.loadAccount(sourcePublicKey);

      const sourceCheck = await checkSourceWallet(server, sourceAccount, parsed.asset, parsed.amount);
      if (sourceCheck) {
        return sourceCheck;
      }

      const destExists = await server.loadAccount(parsed.destination).catch(() => null);

      let builder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE.toString(),
        networkPassphrase,
      });

      if (!destExists && parsed.asset.isNative) {
        builder = builder.addOperation(
          StellarSdk.Operation.createAccount({
            destination: parsed.destination,
            startingBalance: parsed.amount,
          })
        );
      } else {
        builder = builder.addOperation(
          StellarSdk.Operation.payment({
            destination: parsed.destination,
            asset: parsed.asset.isNative ? StellarSdk.Asset.native() : parsed.asset.asset,
            amount: parsed.amount,
          })
        );
      }

      if (parsed.memo) {
        builder = builder.addMemo(StellarSdk.Memo.text(parsed.memo));
      }

      const transaction = builder.setTimeout(30).build();
      transaction.sign(sourceKeypair);

      const result = await server.submitTransaction(transaction);
      // for test pupose only return transaction signed instead of submit
      // const result = {
      //   hash: transaction.hash().toString('hex'),
      //   ledger: 0,
      // };

      return jsonResponse({
        success: true,
        hash: result.hash,
        ledger: result.ledger,
        source: sourcePublicKey,
        destination: parsed.destination,
        amount: parsed.amount,
        asset_code: parsed.asset.assetCode,
        asset_issuer: parsed.asset.isNative ? undefined : parsed.asset.assetIssuer,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return jsonResponse(
        {
          success: false,
          error: message,
        },
        { status: 500 }
      );
    }
  },
};
