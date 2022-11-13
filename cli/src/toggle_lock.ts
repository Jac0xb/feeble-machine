import { program } from "commander";
import * as anchor from "@project-serum/anchor";
import { Program, web3 } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

import { FeebleMachine, IDL } from "../../anchor/target/types/feeble_machine";
import { getMachine } from "./utils";

function programCommand(name: string) {
  return program
    .command(name)
    .requiredOption("-k, --keypair <path>", `Solana wallet location`);
}

programCommand("toggle_lock").action(async (directory, cmd) => {
  const { keypair, rpc } = cmd.opts();

  const connection = new web3.Connection("https://ssc-dao.genesysgo.net/", {
    commitment: "processed",
    confirmTransactionInitialTimeout: 120 * 1000,
  });

  // Load wallet.
  const walletKeyPair = loadWalletKey(keypair);
  const walletWrapper = new anchor.Wallet(walletKeyPair);

  const program = new Program<FeebleMachine>(
    IDL,
    new PublicKey("VENDzam3eJ4Kn8KmVndH7qdF23jMf3NkogyLvA5XJxV"),
    new anchor.AnchorProvider(connection, walletWrapper, {})
  );

  const [machine] = await getMachine(walletWrapper.publicKey, program);

  await program.methods
    .toggleLock(false)
    .accounts({
      authority: walletKeyPair.publicKey,
      machine: machine,
    })
    .rpc();
});

export function loadWalletKey(keypair: string) {
  if (!keypair || keypair == "") {
    throw new Error("Keypair is required!");
  }
  const loaded = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString()))
  );
  console.info(`wallet public key: ${loaded.publicKey}`);
  return loaded;
}
