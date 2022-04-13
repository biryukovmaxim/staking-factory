import * as anchor from "@project-serum/anchor";
import {BN, Program, web3} from "@project-serum/anchor";
import { StakingFactory } from "../target/types/staking_factory";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createAccount,
    createMint, createMultisig, createThawAccountInstruction,
    getAccount, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
let factoryCreator: web3.Keypair;
let factoryCreatorPda: web3.PublicKey;
describe("staking-factory", () => {
  const provider = anchor.Provider.env();
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);
  const program = anchor.workspace.StakingFactory as Program<StakingFactory>;

  factoryCreator = web3.Keypair.generate();
  it("Initialize staking factory!", async () => {
    const tx = await provider.connection.requestAirdrop(factoryCreator.publicKey,  anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(tx);

      [factoryCreatorPda,] = await anchor.web3.PublicKey.findProgramAddress(
        // @ts-ignore
        ['factory_creator'],
        program.programId
    );

    const initTx = await program.methods.initialize(3)
        .accounts({
          creatorPda: factoryCreatorPda,
          factoryCreator: factoryCreator.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([factoryCreator])
        .rpc();
  });
  it("Create stake pool with direct same token policy", async () => {
      const policy = 0;
      const stakePoolCreator = web3.Keypair.generate();
      const tx = await provider.connection.requestAirdrop(stakePoolCreator.publicKey,  anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(tx);
      const stakeMint = await createMint(
          provider.connection,
          stakePoolCreator,
          stakePoolCreator.publicKey,
          undefined,
          2,
      );

      const [stakePoolPda,] = await anchor.web3.PublicKey.findProgramAddress(
          [anchor.utils.bytes.utf8.encode('staking'),
              stakePoolCreator.publicKey.toBytes(),
              stakeMint.toBytes(),
              Uint8Array.from([policy])
          ],
          program.programId
      );

      const stakeKey = await createMultisig(
          provider.connection,
          stakePoolCreator,
          [
              stakePoolCreator.publicKey,
              factoryCreator.publicKey,
              program.programId,
          ],
          1
      );
      const rewardKey = await createMultisig(
          provider.connection,
          stakePoolCreator,
          [
              program.programId,
              factoryCreator.publicKey,
          ],
          1
      );
      const stakeAcc = await getOrCreateAssociatedTokenAccount(provider.connection, stakePoolCreator, stakeMint, stakeKey, true)
      const rewardAcc =   await getOrCreateAssociatedTokenAccount(provider.connection, stakePoolCreator, stakeMint, rewardKey, true)
        await program.methods.createStaking(
            policy,new BN(60),new BN(1),new BN()
        )
            .accounts({
                stacking: stakePoolPda,
                stackingCreator: stakePoolCreator.publicKey,
                factoryCreator: factoryCreatorPda,
                stackingMint: stakeMint,
                generalStakePool:stakeAcc.address,
                rewardMint: stakeMint,
                generalRewardPool: rewardAcc.address,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([stakePoolCreator])
            .rpc();
  });
});
