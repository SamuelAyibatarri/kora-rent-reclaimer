import { 
  Connection, 
  Keypair, 
  SystemProgram, 
  Transaction, 
  sendAndConfirmTransaction 
} from "@solana/web3.js";
import { 
  createInitializeAccountInstruction, 
  createInitializeMintInstruction, 
  TOKEN_PROGRAM_ID, 
  MINT_SIZE, 
  ACCOUNT_SIZE, 
  getMinimumBalanceForRentExemptMint, 
  getMinimumBalanceForRentExemptAccount 
} from "@solana/spl-token";
import fs from 'fs';

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const secretKey = JSON.parse(fs.readFileSync('operator-keypair.json', 'utf-8'));
const operator = Keypair.fromSecretKey(new Uint8Array(secretKey));

async function createEmptyTokenAccount() {
  console.log(`\nCreating Empty Token Account Test`);
  console.log(`Operator: ${operator.publicKey.toBase58()}\n`);

  const mintKeypair = Keypair.generate();
  const mintRent = await getMinimumBalanceForRentExemptMint(connection);

  console.log(`Creating mint: ${mintKeypair.publicKey.toBase58()}`);
  console.log(`Mint rent: ${(mintRent / 1e9).toFixed(6)} SOL\n`);

  const createMintIx = SystemProgram.createAccount({
    fromPubkey: operator.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    space: MINT_SIZE,
    lamports: mintRent,
    programId: TOKEN_PROGRAM_ID,
  });

  const initMintIx = createInitializeMintInstruction(
    mintKeypair.publicKey,
    9, 
    operator.publicKey, 
    operator.publicKey  
  );


  const tokenAccountKeypair = Keypair.generate();
  const accountRent = await getMinimumBalanceForRentExemptAccount(connection);

  console.log(`Creating token account: ${tokenAccountKeypair.publicKey.toBase58()}`);
  console.log(`Token account rent: ${(accountRent / 1e9).toFixed(6)} SOL`);

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: operator.publicKey,
    newAccountPubkey: tokenAccountKeypair.publicKey,
    space: ACCOUNT_SIZE,
    lamports: accountRent,
    programId: TOKEN_PROGRAM_ID,
  });

  const initAccountIx = createInitializeAccountInstruction(
    tokenAccountKeypair.publicKey,
    mintKeypair.publicKey,
    operator.publicKey 
  );

  const tx = new Transaction().add(
    createMintIx, 
    initMintIx, 
    createAccountIx, 
    initAccountIx
  );
  
  console.log(`📤 Sending transaction...`);
  const sig = await sendAndConfirmTransaction(
    connection, 
    tx, 
    [operator, mintKeypair, tokenAccountKeypair],
    { commitment: 'confirmed' }
  );

  console.log(`\n✅ SUCCESS!\n`);
  console.log(`Empty Token Account: ${tokenAccountKeypair.publicKey.toBase58()}`);
  console.log(`Mint: ${mintKeypair.publicKey.toBase58()}`);
  console.log(`Owner: ${operator.publicKey.toBase58()}`);
  console.log(`Rent Locked: ${((mintRent + accountRent) / 1e9).toFixed(6)} SOL`);
  console.log(`\nView on Explorer:`);
  console.log(`https://explorer.solana.com/address/${tokenAccountKeypair.publicKey.toBase58()}?cluster=devnet`);
  console.log(`\nTransaction:`);
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  return {
    tokenAccount: tokenAccountKeypair.publicKey.toBase58(),
    mint: mintKeypair.publicKey.toBase58(),
    owner: operator.publicKey.toBase58(),
    rentLocked: (mintRent + accountRent) / 1e9,
    signature: sig
  };
}

createEmptyTokenAccount().catch(console.error);
