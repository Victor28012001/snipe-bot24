import { Context, Telegraf } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { VersionedTransaction, Connection, Keypair, clusterApiUrl, SendTransactionError, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import nacl from "tweetnacl-ts"
import { PrismaClient, Prisma } from "@prisma/client";
export const db = new PrismaClient();
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import {
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    AccountLayout,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    getOrCreateAssociatedTokenAccount,
    createMint,
    mintTo,
    transfer,
} from "@solana/spl-token";
// import { setInterval } from 'timers/promises';

const ws = new WebSocket('wss://pumpportal.fun/api/data');
const MNEMONIC = process.env.MNEMONIC as string;
export const CONNECTION = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
dotenv.config();

const prisma = new PrismaClient();

// Initialize Telegraf bot
const bot: Telegraf<Context<Update>> = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string);
// Update the userWallets structure to store selected wallet and wallet list
const userWallets: { [chatId: string]: { wallets: string[]; selectedWallet?: string } } = {};
// const RPC_ENDPOINT = process.env.RPC_ENDPOINT as string || "https://api.devnet.solana.com";
// const web3Connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Define trade history and active token monitoring
const tradeHistory: Array<{ token: string; action: string; amount: number; buyPrice: number; sellPrice?: number; timestamp?: number }> = [];
const monitoredTokens: Token[] = [];

// Define the token structure
type Token = { name: string; mint: string };

const getKeyPair = (index: number): Keypair => {
    const seed = bip39.mnemonicToSeedSync(MNEMONIC, "");
    // const hd = HDKey.fromMasterSeed(seed.toString("hex"));
    const path = `m/44'/501'/${index}'/0'`;
    derivePath(path, seed.toString("hex"));

    const keypair = Keypair.fromSeed(derivePath(path, seed.toString("hex")).key);
    return keypair;
};


// Command to connect a wallet
bot.command('start', async (ctx) => {
    try {
        const chatId = ctx.chat?.id.toString();
        if (!chatId) {
            console.error("Chat ID not found");
            return;
        }

        await ctx.reply(
            "Welcome sir, \nPlease wait while we are loading your data"
        );

        // Check if the user already exists in the database
        const isUser = await db.user.findUnique({
            where: {
                uuid: chatId,
            },
        });

        if (isUser) {
            await ctx.reply(
                `Welcome user, \nYour public key is \`${isUser.pubKey}\``,
                { parse_mode: "MarkdownV2" }
            );
            return;
        }

        // Create a new user and their wallet if they do not exist
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const user = await tx.user.create({
                data: {
                    uuid: String(chatId),
                },
            });

            const keypair = getKeyPair(user.id);

            const updatedUser = await tx.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    pubKey: keypair.publicKey.toBase58(),
                },
            });

            await ctx.reply(
                `Welcome user, \nYour public key is \`${updatedUser.pubKey}\``,
                { parse_mode: "MarkdownV2" }
            );
        });
    } catch (error) {
        console.error("Error handling the /start command:", error);
        await ctx.reply("An error occurred while processing your request.");
    }
});



// Command to connect a wallet
bot.command('connect_wallet', (ctx) => {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    const walletAddress = ctx.message?.text?.split(' ')[1]; // Get wallet address from the message

    if (walletAddress) {
        if (!userWallets[chatId]) {
            userWallets[chatId] = { wallets: [] };
        }

        userWallets[chatId].wallets.push(walletAddress);
        ctx.reply(`✅ Wallet ${walletAddress} connected!`);
    } else {
        ctx.reply('❌ Please provide a valid wallet address. Usage: /connect_wallet <wallet_address>');
    }
});

// Command to list connected wallets
bot.command('list_wallets', (ctx) => {
    const chatId = ctx.chat?.id.toString();
    if (!chatId || !userWallets[chatId]) {
        ctx.reply('❌ You have no connected wallets.');
        return;
    }

    const wallets = userWallets[chatId].wallets.join('\n');
    ctx.reply(`Your connected wallets:\n${wallets}`);
});

// Command to switch wallet
bot.command('switch_wallet', (ctx) => {
    const chatId = ctx.chat?.id.toString();
    if (!chatId || !userWallets[chatId]) {
        ctx.reply('❌ You have no connected wallets.');
        return;
    }

    const selectedWallet = ctx.message?.text?.split(' ')[1]; // Get wallet address to switch to

    if (selectedWallet && userWallets[chatId].wallets.includes(selectedWallet)) {
        // Set the selected wallet
        userWallets[chatId].selectedWallet = selectedWallet;
        ctx.reply(`✅ Switched to wallet ${selectedWallet}`);
    } else {
        ctx.reply('❌ Invalid wallet address. Please select a valid wallet.');
    }
});


async function fetchNewTokens(): Promise<Token[]> {
    const tokens: Token[] = [];
    const ws = new WebSocket('wss://pumpportal.fun/api/data');

    return new Promise<Token[]>((resolve, reject) => {
        ws.on('open', function open() {
            const payload = {
                method: "subscribeNewToken"
            };
            ws.send(JSON.stringify(payload));
        });

        ws.on('message', function message(data) {
            try {
                const parsedData = JSON.parse(data.toString());
                console.log('Received data:', parsedData);

                if (isTokenResponse(parsedData)) {
                    const token: Token = {
                        name: parsedData.name,
                        mint: parsedData.mint
                    };
                    console.log('New token:', token);
                    tokens.push(token); // Push token to the array
                }
            } catch (error) {
                console.error('Error parsing message data:', error);
                reject(error);
            }
        });

        ws.on('close', function close() {
            console.log('WebSocket connection closed');
            resolve(tokens); // Resolve when WebSocket closes
        });

        ws.on('error', function error(err) {
            console.error('WebSocket error:', err);
            reject(err);
        });

        // Optional timeout for resolving tokens
        setTimeout(() => {
            ws.close();
        }, 10000); // Adjust timeout as needed
    });
}


// Type guard for a single token response
function isTokenResponse(data: unknown): data is Token {
    return (
        typeof data === 'object' &&
        data !== null &&
        'name' in data && typeof (data as { name: unknown }).name === 'string' &&
        'mint' in data && typeof (data as { mint: unknown }).mint === 'string'
    );
}


const balanceCommand = async (mint: string, bot: Telegraf, chatId: string) => {
    try {
        // Fetch the user from the database
        const user = await db.user.findUnique({ where: { uuid: String(chatId) } });

        // Check if the user exists and has a public key
        if (!user || !user.pubKey) {
            await bot.telegram.sendMessage(chatId, "❌ Command is not valid for you.");
            return;
        }

        // Get user's public key
        const publicKey = new PublicKey(user.pubKey);


        console.log(mint)

        // try {
        //     if (publicKey && CONNECTION) {
        //       const publicKeys = new PublicKey(publicKey);
        //       const senderAssociatedTokenAccount = await getAssociatedTokenAddress(
        //         new PublicKey("3hA3XL7h84N1beFWt3gwSRCDAf5kwZu81Mf1cpUHKzce"),
        //         publicKeys,
        //         false,
        //         TOKEN_PROGRAM_ID,
        //         ASSOCIATED_TOKEN_PROGRAM_ID,
        //       );
        //       const tokenAccountInfo = await CONNECTION.getAccountInfo(senderAssociatedTokenAccount);
        //       if (tokenAccountInfo) {
        //         const tokenAccountData = AccountLayout.decode(tokenAccountInfo.data);
        //         const balance = Number(tokenAccountData.amount) / 10 ** 9;
        //         setTokenBalance(balance);
        //       } else {
        //         setTokenBalance(0);
        //       }
        //     }
        //     setError(null);
        //   } catch (error) {
        //     if (error instanceof Error) {
        //       setError('Error fetching BARK token balance: ' + error.message);
        //     } else {
        //       setError('An unknown error occurred.');
        //     }
        //   }

        // Get or create the associated token account
        // const tokenAccount = await getOrCreateAssociatedTokenAccount(
        //     CONNECTION,
        //     getKeyPair(user.id),
        //     new PublicKey(mint),
        //     getKeyPair(user.id).publicKey
        // );

        // if(tokenAccount){
        //     console.log("token account not found")
        // }

        // // Fetch token balance
        // const tokenBalance = await CONNECTION.getTokenAccountBalance(tokenAccount.address);

        // if(tokenBalance){
        //     console.log("token balance not found")
        // }

        // Fetch SOL balance
        const balance = await CONNECTION.getBalance(publicKey);

        if (balance) {
            console.log("balance not found")
        }

        // Send the balance to the user
        await bot.telegram.sendMessage(
            chatId,
            `💰 Your current balance is:\n\n` +
            `SOL: ${(balance / LAMPORTS_PER_SOL).toFixed(5)} SOL\n ${publicKey}`
            //  +
            // `USDT: ${
            //     tokenBalance.value.amount &&
            //     (parseInt(tokenBalance.value.amount) /
            //         Math.pow(10, tokenBalance.value.decimals)).toFixed(2)
            // } USDT`
        );
    } catch (error) {
        // Handle errors
        if (error instanceof Error) {
            console.error("Error fetching balance:", error);

            // Notify the user about the error
            await bot.telegram.sendMessage(
                chatId,
                `❌ An error occurred while fetching your balance: ${error}`
            );
        } else {
            console.error("Unknown error fetching balance:", error);

            // Notify the user about an unknown error
            await bot.telegram.sendMessage(
                chatId,
                "❌ An unknown error occurred while fetching your balance."
            );
        }
    }
};

const getSOLBalance = async (chatId: string, publicKey: string, bot: any) => {
    try {
        // Convert string publicKey into a valid PublicKey object
        const walletPublicKey = new PublicKey(publicKey);

        // Fetch balance
        const balance = await CONNECTION.getBalance(walletPublicKey);

        // Check and send message
        if (balance === 0) {
            console.log("No SOL found in the wallet.");
            await bot.telegram.sendMessage(chatId, `🚨 Your wallet has no SOL balance.\n\nPublic Key: ${publicKey}`);
        } else {
            console.log(`SOL Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(5)} SOL`);
            await bot.telegram.sendMessage(
                chatId,
                `💰 Your current balance is:\n\n` +
                `SOL: ${(balance / LAMPORTS_PER_SOL).toFixed(5)} SOL\n` +
                `Public Key: ${publicKey}`
            );
        }
    } catch (err) {
        console.error("Error fetching SOL balance:", err);
        await bot.telegram.sendMessage(chatId, "⚠️ Failed to fetch SOL balance. Please check your public key.");
    }
};



// async function buyToken(mint: string, amount: number, slippage: number, bot: Telegraf, chatId: string) {
//     try {
//         const chatIdStr = chatId.toString();
//         const selectedWallet = userWallets[chatIdStr]?.selectedWallet;

//         console.log('Selected Wallet:', selectedWallet);

//         if (!selectedWallet) {
//             await bot.telegram.sendMessage(chatId, '❌ No wallet selected. Please connect and select a wallet first.');
//             return false;
//         }

//         const privateKey = bs58.decode(selectedWallet);

//         let signerKeyPair;
//         if (privateKey.length === 64) {
//             // Valid 64-byte secret key
//             signerKeyPair = Keypair.fromSecretKey(privateKey);
//         } else if (privateKey.length === 32) {
//             // 32-byte private scalar, derive full keypair
//             const derivedKeyPair = nacl.sign_keyPair_fromSecretKey(privateKey); // Correctly derive keypair
//             signerKeyPair = Keypair.fromSecretKey(derivedKeyPair.secretKey);
//         } else {
//             console.error('Invalid private key length:', privateKey.length);
//             await bot.telegram.sendMessage(chatId, '❌ Invalid private key length. Please ensure the private key is correct.');
//             return false;
//         }

//         const response = await fetch('https://pumpportal.fun/api/trade-local', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 publicKey: signerKeyPair.publicKey.toBase58(),
//                 action: 'buy',
//                 mint,
//                 denominatedInSol: 'false',
//                 amount,
//                 slippage,
//                 priorityFee: 0.00001,
//                 pool: 'pump',
//             }),
//         });

//         if (response.ok) {
//             const data = await response.arrayBuffer();
//             const transaction = VersionedTransaction.deserialize(new Uint8Array(data));
//             transaction.sign([signerKeyPair]);
//             const signature = await CONNECTION.sendTransaction(transaction);
//             console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
//             await bot.telegram.sendMessage(chatId, `✅ Successfully bought ${amount} of token: ${mint}`);
//             return true;
//         } else {
//             const errorText = await response.text();
//             console.error('Failed to buy token:', errorText);
//             await bot.telegram.sendMessage(chatId, `❌ Failed to buy tokens: ${mint}. Error: ${errorText}`);
//             return false;
//         }
//     } catch (error) {
//         if (error instanceof Error) {
//             console.error('Error buying token:', error.message);
//             await bot.telegram.sendMessage(chatId, `❌ Error occurred while buying token: ${mint}. Details: ${error.message}`);
//         } else {
//             console.error('Unknown error:', error);
//             await bot.telegram.sendMessage(chatId, `❌ Unknown error occurred while buying token: ${mint}.`);
//         }
//         return false;
//     }
// }


// Sell token when 20% profit is reached


async function buyToken(
    mint: string,
    amount: number,
    slippage: number,
    bot: Telegraf,
    chatId: string
) {
    try {
        const user = await db.user.findUnique({ where: { uuid: String(chatId) } });

        if (!user || !user.pubKey) {
            await bot.telegram.sendMessage(
                chatId,
                "❌ User not found or required keys are missing."
            );
            return false;
        }

        balanceCommand(mint, bot, chatId)
        getSOLBalance(chatId, user.pubKey, bot);

        const userPair = getKeyPair(user.id);
        // const mainPair = getKeyPair(0);
        // const userPrivateKey = getKeyPair(0).secretKey;
        // const signerKeyPair = Keypair.fromSecretKey(userPrivateKey);
        const response = await fetch("https://pumpportal.fun/api/trade-local", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                publicKey: userPair.publicKey,
                action: "buy",
                mint: mint,
                denominatedInSol: "false",
                amount: amount,
                slippage: slippage,
                priorityFee: 0.00001,
                pool: "pump",
            }),
        });

        if (response.status === 200) {
            const data = await response.arrayBuffer();
            const tx = VersionedTransaction.deserialize(new Uint8Array(data));

            console.log(userPair)
            const { blockhash } = await CONNECTION.getLatestBlockhash();
            tx.message.recentBlockhash = blockhash;
            tx.sign([userPair]);


            // Send the transaction to the Solana network
            try {
                const signature = await CONNECTION.sendTransaction(tx);
                const confirmation = await CONNECTION.confirmTransaction(signature, 'confirmed');

                if (confirmation.value.err) {
                    console.error("Transaction failed:", confirmation.value.err);

                    const transactionDetails = await CONNECTION.getTransaction(signature);
                    const logs = transactionDetails?.meta?.logMessages;
                    if (logs && logs.length > 0) {
                        console.error("Transaction logs:", logs);
                        await bot.telegram.sendMessage(
                            chatId,
                            `❌ Transaction failed: ${confirmation.value.err}. Logs: ${logs.join(', ')}`
                        );
                    } else {
                        console.error("No logs available for this transaction.");
                        await bot.telegram.sendMessage(
                            chatId,
                            `❌ Transaction failed: ${confirmation.value.err}. No logs available.`
                        );
                    }
                } else {
                    await bot.telegram.sendMessage(
                        chatId,
                        `✅ Successfully bought ${amount} tokens (mint: ${mint}). Transaction: https://solscan.io/tx/${signature}`
                    );

                    // Add to trade history
                    const price = 0; // Define a default price or fetch the actual price
                    tradeHistory.push({
                        token: mint,
                        action: 'buy',
                        amount,
                        buyPrice: price,
                        timestamp: Date.now(),
                    });

                    return true;
                }
            } catch (sendTransactionError: unknown) {
                if (sendTransactionError instanceof Error) {
                    console.error("SendTransactionError:", sendTransactionError.message);
                    // await bot.telegram.sendMessage(
                    //     chatId,
                    //     `❌ Transaction failed with error: ${sendTransactionError.message}`
                    // );
                } else {
                    console.error("Unknown SendTransactionError:", sendTransactionError);
                    // await bot.telegram.sendMessage(
                    //     chatId,
                    //     `❌ Transaction failed with an unknown error.`
                    // );
                }
            }

        } else {
            const errorText = await response.text();
            console.error("API Error:", errorText);
            // await bot.telegram.sendMessage(
            //     chatId,
            //     `❌ Failed to process the transaction: ${response.statusText}`
            // );
            return false;
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error buying token:", error.message);
            // await bot.telegram.sendMessage(
            //     chatId,
            //     `❌ Error occurred while buying token: ${error.message} ${SendTransactionError}`
            // );
        } else {
            console.error("Unknown error:", error);
            await bot.telegram.sendMessage(chatId, "❌ Unknown error occurred.");
        }
        return false;
    }
}

async function sellToken(token: string, amount: number, bot: Telegraf, chatId: string, retries: number = 3) {
    const user = await db.user.findUnique({ where: { uuid: String(chatId) } });

    if (!user || !user.pubKey) {
        await bot.telegram.sendMessage(
            chatId,
            "❌ User not found or required keys are missing."
        );
        return false;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await balanceCommand(token, bot, chatId);
            await getSOLBalance(chatId, user.pubKey, bot);

            const userPair = getKeyPair(user.id);

            const trade = tradeHistory.find((t) => t.token === token);
            await bot.telegram.sendMessage(chatId, `✅ ${token} ${trade}`);
            // if (trade) {
                // Decode the private key from the selected wallet (assumed to be in base58 format)
                // const privateKey = bs58.decode(selectedWallet);
                // const signerKeyPair = Keypair.fromSecretKey(privateKey);

                const response = await fetch('https://pumpportal.fun/api/trade-local', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        publicKey: userPair.publicKey,
                        action: 'sell',
                        mint: token,
                        denominatedInSol: 'false',
                        amount,
                        slippage: 15,
                        priorityFee: 0.00001,
                        pool: 'pump',
                    }),
                });

                if (response.status === 200) {
                    const data = await response.arrayBuffer();
                    const tx = VersionedTransaction.deserialize(new Uint8Array(data));

                    console.log(userPair);
                    const { blockhash } = await CONNECTION.getLatestBlockhash();
                    tx.message.recentBlockhash = blockhash;
                    tx.sign([userPair]);

                    // Send the transaction to the Solana network
                    const signature = await CONNECTION.sendTransaction(tx);
                    const confirmation = await CONNECTION.confirmTransaction(signature, 'confirmed');

                    if (confirmation.value.err) {
                        console.error("Transaction failed:", confirmation.value.err);

                        const transactionDetails = await CONNECTION.getTransaction(signature);
                        const logs = transactionDetails?.meta?.logMessages;
                        if (logs && logs.length > 0) {
                            console.error("Transaction logs:", logs);
                            await bot.telegram.sendMessage(
                                chatId,
                                `❌ Transaction failed: ${confirmation.value.err}. Logs: ${logs.join(', ')}`
                            );
                        } else {
                            console.error("No logs available for this transaction.");
                            await bot.telegram.sendMessage(
                                chatId,
                                `❌ Transaction failed: ${confirmation.value.err}. No logs available.`
                            );
                        }
                    } else {
                        await bot.telegram.sendMessage(
                            chatId,
                            `✅ Successfully sold ${amount} of tokens (mint: ${token}) after 20 seconds!. Transaction: https://solscan.io/tx/${signature}`
                        );

                        // Add to trade history
                        const price = 0; // Define a default price or fetch the actual price
                        tradeHistory.push({
                            token: token,
                            action: 'sell',
                            amount,
                            buyPrice: price,
                            timestamp: Date.now(),
                        });

                        return true;
                    }
                } else {
                    const errorText = await response.text();
                    console.error("API Error:", errorText);
                    throw new Error(`Failed to process the transaction: ${response.statusText}`);
                }
            // }
        } catch (error) {
            if (error instanceof Error) {
                console.error(`Attempt ${attempt} - Error selling token:`, error.message);
                if (attempt === retries) {
                    await bot.telegram.sendMessage(
                        chatId,
                        `❌ Error occurred while selling token: ${error.message}`
                    );
                }
            } else {
                console.error(`Attempt ${attempt} - Unknown error:`, error);
                if (attempt === retries) {
                    await bot.telegram.sendMessage(chatId, "❌ Unknown error occurred.");
                }
            }
        }
    }

    return false;
}




async function monitorAndTrade(bot: Telegraf) {
    try {
        const newTokens: Token[] = await fetchNewTokens();
        console.log('New tokens detected:', newTokens);

        // Insert new tokens into the tokens table
        for (const token of newTokens) {
            await db.token.create({
                data: {
                    mint: token.mint,
                    name: token.name,
                    price: 0,
                    processed: false, // Add the processed field
                },
            });
            console.log(`🚀 Added new token to database: ${token.name} (${token.mint})`);
        }

        // Retrieve all unprocessed tokens from the tokens table
        const unprocessedTokens = await db.token.findMany({
            where: { processed: false },
        });

        const token = newTokens[0]
            console.log(`🚀 Monitoring token from database: ${token.name} (${token.mint})`);

            await bot.telegram.sendMessage(
                process.env.TELEGRAM_CHAT_ID as string,
                `🚀 Monitoring token from database: ${token.name} (${token.mint})`
            );
            setTimeout(async () => {
                const buySuccess = await buyToken(token.mint, 350000, 10, bot, process.env.TELEGRAM_CHAT_ID as string);

                console.log(buySuccess);
                // if (buySuccess) {
                    tradeHistory.push({ token: token.mint, action: 'buy', amount: 350000, buyPrice: 1.0 });

                    // Mark the token as processed in the database
                    await db.token.update({
                        where: { mint: token.mint },
                        data: { processed: true },
                    });

                    // Add a 20-second delay before attempting to sell
                    setTimeout(async () => {
                        await sellToken(token.mint, 350000, bot, process.env.TELEGRAM_CHAT_ID as string); // Assuming 1.2 as the current price
                    }, 3000); // 20 seconds in milliseconds
                // }

            }, 60000); // 20 seconds in milliseconds
        // }
    } catch (error) {
        console.error('Error monitoring tokens:', error);
    }
}


// Start monitoring
(async () => {

    console.log('Starting token monitoring...');
    setInterval(() => { monitorAndTrade(bot); }, 80000); // Monitor every 30 seconds

    bot.launch();
})();
