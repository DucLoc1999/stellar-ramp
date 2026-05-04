import 'dotenv/config';
import { Asset } from '@stellar/stellar-sdk';
import { loadHotWallet, executeStellarPayment, ensureTrustline, hasTrustline, DEFAULT_ASSET_CODE, SUPPORTED_TOKEN_ISSUER } from '../src/services/stellarService';
import db from '../src/db';

async function main() {
  const recipient = 'GABQEQMD4XALCSMHHMUBXHSXQPWOV47WMF5F4UCUZFR7DRD37OSX7SDH';
  const amount = '1';
  const tokenIssuer = process.env.TOKEN_ADDRESS || SUPPORTED_TOKEN_ISSUER;
  const assetCode = process.env.ASSET_CODE || DEFAULT_ASSET_CODE;

  const walletName = process.env.STELLAR_HOT_WALLET_NAME || 'stellar_hot_wallet';
  console.log(`Loading wallet: ${walletName}`);
  const wallet = await loadHotWallet();
  console.log(`From: ${wallet.publicKey}`);

  console.log(`Checking trustline for ${assetCode}...`);
  const trustlineExists = await hasTrustline(wallet.publicKey, assetCode, tokenIssuer);
  if (!trustlineExists) {
    console.log(`No trustline. Creating...`);
    const result = await ensureTrustline(wallet.keypair, assetCode, tokenIssuer);
    if (!result.success) {
      console.error(`Trustline failed: ${result.error}`);
      process.exit(1);
    }
    console.log(`Trustline created. Hash: ${result.hash}`);
  } else {
    console.log(`Trustline exists.`);
  }

  const asset = new Asset(assetCode, tokenIssuer);
  console.log(`Sending ${amount} ${assetCode} to ${recipient}...`);

  const result = await executeStellarPayment(recipient, amount, asset);

  if (result.success) {
    console.log(`Success! Hash: ${result.hash}`);
  } else {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }

  await db.destroy();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});