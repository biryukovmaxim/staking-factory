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
import * as console from "console";

let factoryCreator: web3.Keypair;
let factoryCreatorPda: web3.PublicKey;
let stakePoolPda: web3.PublicKey;
let stakePoolCreator: web3.Keypair;
const systemProgram = web3.SystemProgram.programId;
let user: web3.Keypair;
let stakeMint: web3.PublicKey;
let userAccountPda: web3.PublicKey;
let generalFreeTokensAcc: web3.PublicKey;
let freeTokens: web3.PublicKey;

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

    await program.methods.initialize(3)
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
      stakePoolCreator = web3.Keypair.generate();
      const tx = await provider.connection.requestAirdrop(stakePoolCreator.publicKey,  anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(tx);
      stakeMint = await createMint(
          provider.connection,
          stakePoolCreator,
          stakePoolCreator.publicKey,
          undefined,
          2,
      );

      [stakePoolPda,] = await anchor.web3.PublicKey.findProgramAddress(
          [anchor.utils.bytes.utf8.encode('staking'),
              stakePoolCreator.publicKey.toBytes(),
              stakeMint.toBytes(),
              Uint8Array.from([policy])
          ],
          program.programId
      );

      const [stakedTokens,] = await anchor.web3.PublicKey.findProgramAddress(
          [anchor.utils.bytes.utf8.encode('staked_tokens'),
              stakePoolCreator.publicKey.toBytes(),
              stakeMint.toBytes(),
              Uint8Array.from([policy])
          ],
          program.programId
      );
      [freeTokens,] = await anchor.web3.PublicKey.findProgramAddress(
          [anchor.utils.bytes.utf8.encode('free_tokens'),
              stakePoolCreator.publicKey.toBytes(),
              stakeMint.toBytes(),
              Uint8Array.from([policy])
          ],
          program.programId
      );
      const [rewardTokens,] = await anchor.web3.PublicKey.findProgramAddress(
          [anchor.utils.bytes.utf8.encode('reward_tokens'),
              stakePoolCreator.publicKey.toBytes(),
              stakeMint.toBytes(),
              Uint8Array.from([policy])
          ],
          program.programId
      );
      const stakeAcc = await getAssociatedTokenAddress(stakeMint, stakedTokens, true)
      const rewardAcc =   await getAssociatedTokenAddress(stakeMint, rewardTokens, true)
      generalFreeTokensAcc = await getAssociatedTokenAddress(stakeMint, freeTokens, true)
        await program.methods.createStaking(
            policy,new BN(60),new BN(1),new BN()
        )
            .accounts({
                stacking: stakePoolPda,
                stackingCreator: stakePoolCreator.publicKey,
                factoryCreator: factoryCreatorPda,
                stackingMint: stakeMint,
                generalStakePool:stakeAcc,
                rewardMint: stakeMint,
                generalRewardPool: rewardAcc,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                freeTokens: freeTokens,
                stakedTokens: stakedTokens,
                rewardTokens: rewardTokens,
                generalFreePool: generalFreeTokensAcc,
            })
            .signers([stakePoolCreator])
            .rpc();

      await mintTo(provider.connection, stakePoolCreator, stakeMint, rewardAcc, stakePoolCreator, 100000000)

  });
  it("Initialize user account!", async () => {
      user = web3.Keypair.generate();
      const tx = await provider.connection.requestAirdrop(user.publicKey,  anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(tx);

      [userAccountPda,] = await anchor.web3.PublicKey.findProgramAddress(
          [anchor.utils.bytes.utf8.encode('user'),
              user.publicKey.toBytes(),
              stakePoolPda.toBytes(),
          ],
          program.programId
      );
      await program.methods.createUserAccount().accounts
      ({
              account: userAccountPda,
          user: user.publicKey,
          stacking: stakePoolPda,
          systemProgram,
          })
          .signers([user])
          .rpc()
  })
    it("deposit user account!", async () => {
        const userTokens = await getOrCreateAssociatedTokenAccount(provider.connection, user, stakeMint, user.publicKey)
        await mintTo(provider.connection, user, stakeMint, userTokens.address, stakePoolCreator,1000)
        await program.methods.deposit(new BN(100)).accounts({
            account: userAccountPda,
            user: user.publicKey,
            staking: stakePoolPda,
            source: userTokens.address,
            mint: stakeMint,
            freeTokens: freeTokens,
            destination: generalFreeTokensAcc,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
        })
            .signers([user])
            .rpc()
        // todo check balance

    })
});
