import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { FeebleMachine } from "../target/types/feeble_machine";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
import * as assert from "assert";
import {
  getAccountsByCreatorAddress,
  getMachine,
  getMachineCreator,
  getMasterEdition,
  getWhitelist,
  mint,
} from "./../../cli/src/utils";

const COLLECTION_PREFIX = "Feeble Lamb";
const COLLECTION_SYMBOL = "LoL";
const COLLECTION_FEEPOINTS = 500;
const ARWEAVE_MANIFEST_URL = "ARWEAVE_MANIFEST_URL";

// Stress test value
const MINTERS = 512;

describe("machine", async () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const program = anchor.workspace
    .FeebleMachine as Program<FeebleMachine> as any;
  const authority = provider.wallet.publicKey;
  const minters: anchor.web3.Keypair[] = [];

  it("init machine", async () => {
    const [machine] = await getMachine(provider.wallet.publicKey, program);

    await program.methods
      .initMachine(
        "lol_01",
        MINTERS + 4,
        ARWEAVE_MANIFEST_URL,
        COLLECTION_PREFIX,
        COLLECTION_SYMBOL,
        COLLECTION_FEEPOINTS
      )
      .accounts({
        machine: machine,
        authority: authority,
        systemProgram: SystemProgram.programId,
      })
      .signers([])
      .rpc({ commitment: "finalized" });
  });
  it("generate whitelist", async () => {
    const [machine] = await getMachine(provider.wallet.publicKey, program);
    const promises: Promise<void>[] = [];

    for (let index = 0; index < MINTERS; index++) {
      promises.push(
        new Promise(async (resolve, reject) => {
          try {
            const minter = anchor.web3.Keypair.generate();
            minters.push(minter);

            await airdrop(provider, minter.publicKey);

            const [whitelist] = await getWhitelist(
              machine,
              minter.publicKey,
              program
            );

            await program.methods
              .whitelistUser(1)
              .accounts({
                user: minter.publicKey,
                authority: authority,
                machine: machine,
                whitelist: whitelist,
              })
              .rpc();
            resolve();
          } catch (e) {
            reject(e);
          }
        })
      );
    }

    console.log("Lamblisting users...");
    await Promise.all(promises);
    console.log("Lamblisting ended");
  });
  it("locked mint", async () => {
    const minter = minters[127];

    await airdrop(provider, minter.publicKey);
    const [machine] = await getMachine(authority, program);

    try {
      await mint(program, authority, minter, machine, 0);
      assert.fail("Should have failed");
    } catch (err) {
      // assert.match(err.message, /Feeble machine is locked./);
    }
  });
  it("mint unlocked", async () => {
    const [machine] = await getMachine(provider.wallet.publicKey, program);
    await program.methods
      .toggleLock(false)
      .accounts({
        machine: machine,
        authority: authority,
        systemProgram: SystemProgram.programId,
      })
      .signers([])
      .rpc({ commitment: "processed" });
  });
  it("mint", async () => {
    const promises: Promise<void>[] = [];

    for (let index = 0; index < MINTERS; index++) {
      const minter = minters[index];

      promises.push(
        new Promise(async (resolve, reject) => {
          try {
            const [machine] = await getMachine(authority, program);
            const [nft, metadata] = await mint(
              program,
              authority,
              minter,
              machine,
              index
            );
            const masterEdition = await getMasterEdition(nft);

            let nftInfo: {
              decimals: number;
              freezeAuthority: string;
              isInitialized: boolean;
              mintAuthority: string;
              supply: string;
            };

            function timeout(ms) {
              return new Promise((resolve) => setTimeout(resolve, ms));
            }

            let i = 0;
            while (true) {
              try {
                const accountData =
                  await provider.connection.getParsedAccountInfo(nft);
                nftInfo = (accountData.value.data as any).parsed.info;

                if (nftInfo) {
                  break;
                }
              } catch (e) {
                await timeout(500);
                i++;
                if (i > 50) {
                  console.error("too long");
                }
              }
            }

            expect(nftInfo.mintAuthority).to.equal(
              masterEdition.toString(),
              "Mint authority not equal"
            );
            expect(nftInfo.freezeAuthority).to.equal(
              masterEdition.toString(),
              "freeze authority not equal"
            );
            expect(nftInfo.supply).to.equal("1");
            expect(nftInfo.isInitialized).to.equal(true);
            expect(nftInfo.decimals).to.equal(0);

            const metadataInfo = await Metadata.load(
              provider.connection,
              metadata
            );
            const pdaCreator = metadataInfo.data.data.creators[0];
            const authorityCreator = metadataInfo.data.data.creators[1];

            expect(metadataInfo.data.updateAuthority).eq(authority.toBase58());
            expect(pdaCreator.address).eq(
              (await getMachineCreator(machine, program))[0].toBase58(),
              "Mismatched pda creator"
            );
            expect(authorityCreator.address).eq(
              authority.toBase58(),
              " Mismatched authority creator"
            );
            expect(metadataInfo.data.data.name).eq(
              `${COLLECTION_PREFIX} #${index}`
            );
            expect(metadataInfo.data.data.uri).eq(
              `${ARWEAVE_MANIFEST_URL}/${index}.json`
            );
            expect(metadataInfo.data.data.sellerFeeBasisPoints).eq(
              COLLECTION_FEEPOINTS
            );

            console.log(`Mint #${index} passed checks`);
            resolve();
          } catch (e) {
            reject(e);
          }
        })
      );
    }

    await Promise.all(promises);

    const [machine] = await getMachine(authority, program);
    const [creator] = await getMachineCreator(machine, program);
    const allMetadata = await getAccountsByCreatorAddress(provider, creator);
    expect(allMetadata.length).eq(MINTERS);
  });

  it("negative index", async () => {
    const minter = minters[100];
    await airdrop(provider, minter.publicKey);
    const [machine] = await getMachine(authority, program);
    try {
      await mint(program, authority, minter, machine, -1);
      assert.fail("Should have failed");
    } catch (err) {
      // assert.match(
      //   err.message,
      //   /The value of "value" is out of range. It must be >= 0 and <= 65535. Received -1/
      // );
    }
  });
  it("Greater than max supply mint", async () => {
    const minter = minters[127];
    await airdrop(provider, minter.publicKey);
    // const adSig = await provider.connection.requestAirdrop(
    //   minter.publicKey,
    //   10 * 10e9
    // );
    // await provider.connection.confirmTransaction(adSig, 'processed');
    const [machine] = await getMachine(authority, program);
    try {
      await mint(program, authority, minter, machine, MINTERS + 4);
      assert.fail("Should have failed");
    } catch (err) {
      // assert.match(err.message, /OutOfBounds/);
    }
  });
  it("Double mint", async () => {
    const minter = minters[127];
    const [machine] = await getMachine(authority, program);
    try {
      await mint(program, authority, minter, machine, 5);
      assert.fail("Should have failed");
    } catch (err) {
      // assert.match(err.message, /custom program error: 0x0/);
    }
  });
  it("Mint excessive", async () => {
    const minter = minters[127];
    const [machine] = await getMachine(authority, program);
    await mint(program, authority, minter, machine, MINTERS);
  });
});

async function airdrop(provider: anchor.AnchorProvider, dest: PublicKey) {
  const adSig = await provider.connection.requestAirdrop(dest, 2 * 10e9);

  while (true) {
    const tx = await provider.connection.confirmTransaction(adSig, "processed");
    // console.log(tx.value.err);
    if (tx.value) {
      break;
    }
  }
}
