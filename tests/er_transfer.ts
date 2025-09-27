import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { ErTransfer } from "../target/types/er_transfer";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { getClosestValidator, sendMagicTransaction } from "magic-router-sdk";
import { BN } from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";
import fs from "fs";
import { Keypair } from "@solana/web3.js";

const secretKeyString = fs.readFileSync("./wallet.json", "utf8");
const secretKey = Uint8Array.from(JSON.parse(secretKeyString));

const XeeshanKeypair = Keypair.fromSecretKey(secretKey);

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.ErTransfer as Program<ErTransfer>;


describe("ER Transfer", () => {

  let userBalanceAccount: PublicKey;
  let xeeshanBalanceAccount: PublicKey;

  const routerConnection = new anchor.AnchorProvider(
		new anchor.web3.Connection(
			process.env.PROVIDER_ENDPOINT || "https://devnet.magicblock.app/",
			{
				wsEndpoint:
					process.env.WS_ENDPOINT || "wss://devnet.magicblock.app/",
			}
		),
		anchor.Wallet.local()
	);

  console.log("Router Endpoint: ", provider.connection.rpcEndpoint);

  before(async() => {
    [userBalanceAccount] = PublicKey.findProgramAddressSync(
      [provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    [xeeshanBalanceAccount] = PublicKey.findProgramAddressSync(
      [XeeshanKeypair.publicKey.toBuffer()],
      program.programId
    );

  });

  it("Initialize", async () => {
    const tx = await program.methods.initialize()
      .accountsPartial({ 
        user: provider.wallet.publicKey,
        balance: userBalanceAccount,
        systemProgram: SystemProgram.programId
      }).signers([provider.wallet.payer]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  });

  it("Xeeshan balance account", async () => {
    const tx = await program.methods.initialize()
      .accountsPartial({ 
        user: XeeshanKeypair.publicKey,
        balance: xeeshanBalanceAccount,
        systemProgram: SystemProgram.programId
    }).signers([XeeshanKeypair]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  });

  it("Transfer", async () => {
    let amount = new BN(1);

    const tx = await program.methods.transfer(amount).accountsPartial({
      payer: provider.wallet.publicKey,
      balance: userBalanceAccount,
      receiver: XeeshanKeypair.publicKey,
      receiverBalance: xeeshanBalanceAccount,
      systemProgram: SystemProgram.programId
    }).signers([provider.wallet.payer]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  })

  it("Delegate User Account", async () => {
    const validator = await getClosestValidator(provider.connection);

    const tx = await program.methods.delegateBalance({ commitFrequencyMs: 30000, validator }).accountsPartial({
      payer: provider.wallet.publicKey,
      balance: userBalanceAccount,
    }).signers([provider.wallet.payer]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  });

  it("Delegate Xeeshan Account", async () => {
    const validator = await getClosestValidator(provider.connection);

    const tx = await program.methods.delegateBalance({ commitFrequencyMs: 30000, validator }).accountsPartial({
      payer:  XeeshanKeypair.publicKey,
      balance: xeeshanBalanceAccount,
    }).signers([XeeshanKeypair]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  });

  it("Perform transfer on ER", async () => {
    const blockhashData = await provider.connection.getLatestBlockhash();
    
    let tx = await program.methods.transfer(new BN(5)).accountsPartial({
      payer: provider.wallet.publicKey,
      balance: userBalanceAccount, 
      receiver: XeeshanKeypair.publicKey,
      receiverBalance: xeeshanBalanceAccount, 
      systemProgram: SystemProgram.programId
    }).transaction();

    tx.recentBlockhash = ( await routerConnection.connection.getLatestBlockhash() ).blockhash;
    tx.feePayer = routerConnection.wallet.publicKey;
    tx.lastValidBlockHeight = blockhashData.lastValidBlockHeight;

    // const signature = await sendMagicTransaction(
    //   routerConnection,  
    //   tx1,
    //   [provider.wallet.payer]
    // );

    // console.log(`Transaction Signature: ${signature}`);

    tx = await routerConnection.wallet.signTransaction(tx);
    let txHash = await routerConnection.sendAndConfirm(tx);
    console.log("Transaction Hash: ", txHash);
  })

})
