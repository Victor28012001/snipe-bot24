"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONNECTION = void 0;
const telegraf_1 = require("telegraf");
const fs_1 = __importDefault(require("fs"));
const web3_js_1 = require("@solana/web3.js");
const ws_1 = __importDefault(require("ws"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
// import { setInterval } from 'timers/promises';
const ws = new ws_1.default('wss://pumpportal.fun/api/data');
const MNEMONIC = process.env.MNEMONIC;
exports.CONNECTION = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("mainnet-beta"), "confirmed");
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
// Initialize Telegraf bot
const bot = new telegraf_1.Telegraf("7863912376:AAG2xznH6UEh8UkGtaPTX6tcjubu058WSHY");
// const bot: Telegraf<Context<Update>> = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string);
// Update the userWallets structure to store selected wallet and wallet list
const userWallets = {};
// Define trade history and active token monitoring
const tradeHistory = [];
const monitoredTokens = [];
// const getKeyPair = (index: number): Keypair => {
//     const seed = bip39.mnemonicToSeedSync(MNEMONIC, "");
//     // const hd = HDKey.fromMasterSeed(seed.toString("hex"));
//     const path = `m/44'/501'/${index}'/0'`;
//     derivePath(path, seed.toString("hex"));
//     const keypair = Keypair.fromSeed(derivePath(path, seed.toString("hex")).key);
//     return keypair;
// };
/**
 * Load a keypair from a JSON file.
 * @param filePath - The path to the keypair JSON file.
 * @returns {Keypair} - The loaded Keypair object.
 */
const getKeyPair = (filePath) => {
    // Read the keypair JSON file
    const keypairData = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
    // Convert the secret key data back to a Keypair object
    const keypair = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(keypairData));
    return keypair;
};
// Example usage
// const keypair = getKeyPair('./keypair.json');
// console.log('Public Key:', keypair.publicKey.toBase58());
// Command to connect a wallet
bot.command('start', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const chatId = (_a = ctx.chat) === null || _a === void 0 ? void 0 : _a.id.toString();
        if (!chatId) {
            console.error("Chat ID not found");
            return;
        }
        yield ctx.reply("Welcome sir, \nPlease wait while we are loading your data");
        // Check if the user already exists in the database
        const isUser = getKeyPair('keypair.json');
        if (isUser) {
            yield ctx.reply(`Welcome user, \nYour public key is \`${isUser.publicKey.toBase58()}\``, { parse_mode: "MarkdownV2" });
            return;
        }
        // Create a new user and their wallet if they do not exist
        // await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        //     const user = await tx.user.create({
        //         data: {
        //             uuid: String(chatId),
        //         },
        //     });
        //     const keypair = getKeyPair('keypair.json');
        //     const updatedUser = await tx.user.update({
        //         where: {
        //             id: user.id,
        //         },
        //         data: {
        //             pubKey: keypair.publicKey.toBase58(),
        //         },
        //     });
        //     await ctx.reply(
        //         `Welcome user, \nYour public key is \`${updatedUser.pubKey}\``,
        //         { parse_mode: "MarkdownV2" }
        //     );
        // });
    }
    catch (error) {
        console.error("Error handling the /start command:", error);
        yield ctx.reply("An error occurred while processing your request.");
    }
}));
// Command to connect a wallet
bot.command('connect_wallet', (ctx) => {
    var _a, _b, _c;
    const chatId = (_a = ctx.chat) === null || _a === void 0 ? void 0 : _a.id.toString();
    if (!chatId)
        return;
    const walletAddress = (_c = (_b = ctx.message) === null || _b === void 0 ? void 0 : _b.text) === null || _c === void 0 ? void 0 : _c.split(' ')[1]; // Get wallet address from the message
    if (walletAddress) {
        if (!userWallets[chatId]) {
            userWallets[chatId] = { wallets: [] };
        }
        userWallets[chatId].wallets.push(walletAddress);
        ctx.reply(`✅ Wallet ${walletAddress} connected!`);
    }
    else {
        ctx.reply('❌ Please provide a valid wallet address. Usage: /connect_wallet <wallet_address>');
    }
});
// Command to list connected wallets
bot.command('list_wallets', (ctx) => {
    var _a;
    const chatId = (_a = ctx.chat) === null || _a === void 0 ? void 0 : _a.id.toString();
    if (!chatId || !userWallets[chatId]) {
        ctx.reply('❌ You have no connected wallets.');
        return;
    }
    const wallets = userWallets[chatId].wallets.join('\n');
    ctx.reply(`Your connected wallets:\n${wallets}`);
});
// Command to switch wallet
bot.command('switch_wallet', (ctx) => {
    var _a, _b, _c;
    const chatId = (_a = ctx.chat) === null || _a === void 0 ? void 0 : _a.id.toString();
    if (!chatId || !userWallets[chatId]) {
        ctx.reply('❌ You have no connected wallets.');
        return;
    }
    const selectedWallet = (_c = (_b = ctx.message) === null || _b === void 0 ? void 0 : _b.text) === null || _c === void 0 ? void 0 : _c.split(' ')[1]; // Get wallet address to switch to
    if (selectedWallet && userWallets[chatId].wallets.includes(selectedWallet)) {
        // Set the selected wallet
        userWallets[chatId].selectedWallet = selectedWallet;
        ctx.reply(`✅ Switched to wallet ${selectedWallet}`);
    }
    else {
        ctx.reply('❌ Invalid wallet address. Please select a valid wallet.');
    }
});
function fetchNewTokens() {
    return __awaiter(this, void 0, void 0, function* () {
        const tokens = [];
        const ws = new ws_1.default('wss://pumpportal.fun/api/data');
        return new Promise((resolve, reject) => {
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
                        const token = {
                            name: parsedData.name,
                            mint: parsedData.mint
                        };
                        console.log('New token:', token);
                        tokens.push(token); // Push token to the array
                    }
                }
                catch (error) {
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
    });
}
// Type guard for a single token response
function isTokenResponse(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'name' in data && typeof data.name === 'string' &&
        'mint' in data && typeof data.mint === 'string');
}
const balanceCommand = (mint, bot, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Fetch the user from the database
        // const user = await db.user.findUnique({ where: { uuid: String(chatId) } });
        // // Check if the user exists and has a public key
        // if (!user || !user.pubKey) {
        //     await bot.telegram.sendMessage(chatId, "❌ Command is not valid for you.");
        //     return;
        // }
        // Get user's public key
        const isUser = getKeyPair('keypair.json');
        const publicKey = new web3_js_1.PublicKey(isUser.publicKey.toBase58());
        console.log(mint);
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
        const balance = yield exports.CONNECTION.getBalance(publicKey);
        if (balance) {
            console.log("balance not found");
        }
        // Send the balance to the user
        yield bot.telegram.sendMessage(chatId, `💰 Your current balance is:\n\n` +
            `SOL: ${(balance / web3_js_1.LAMPORTS_PER_SOL).toFixed(5)} SOL\n ${publicKey}`
        //  +
        // `USDT: ${
        //     tokenBalance.value.amount &&
        //     (parseInt(tokenBalance.value.amount) /
        //         Math.pow(10, tokenBalance.value.decimals)).toFixed(2)
        // } USDT`
        );
    }
    catch (error) {
        // Handle errors
        if (error instanceof Error) {
            console.error("Error fetching balance:", error);
            // Notify the user about the error
            yield bot.telegram.sendMessage(chatId, `❌ An error occurred while fetching your balance: ${error}`);
        }
        else {
            console.error("Unknown error fetching balance:", error);
            // Notify the user about an unknown error
            yield bot.telegram.sendMessage(chatId, "❌ An unknown error occurred while fetching your balance.");
        }
    }
});
const getSOLBalance = (chatId, publicKey, bot) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Convert string publicKey into a valid PublicKey object
        const walletPublicKey = new web3_js_1.PublicKey(publicKey);
        // Fetch balance
        const balance = yield exports.CONNECTION.getBalance(walletPublicKey);
        // Check and send message
        if (balance === 0) {
            console.log("No SOL found in the wallet.");
            yield bot.telegram.sendMessage(chatId, `🚨 Your wallet has no SOL balance.\n\nPublic Key: ${publicKey}`);
        }
        else {
            console.log(`SOL Balance: ${(balance / web3_js_1.LAMPORTS_PER_SOL).toFixed(5)} SOL`);
            yield bot.telegram.sendMessage(chatId, `💰 Your current balance is:\n\n` +
                `SOL: ${(balance / web3_js_1.LAMPORTS_PER_SOL).toFixed(5)} SOL\n` +
                `Public Key: ${publicKey}`);
        }
    }
    catch (err) {
        console.error("Error fetching SOL balance:", err);
        yield bot.telegram.sendMessage(chatId, "⚠️ Failed to fetch SOL balance. Please check your public key.");
    }
});
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
function buyToken(mint, amount, slippage, bot, chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            // const user = await db.user.findUnique({ where: { uuid: String(chatId) } });
            // if (!user || !user.pubKey) {
            //     await bot.telegram.sendMessage(
            //         chatId,
            //         "❌ User not found or required keys are missing."
            //     );
            //     return false;
            // }
            balanceCommand(mint, bot, chatId);
            const isUser = getKeyPair('keypair.json');
            getSOLBalance(chatId, isUser.publicKey.toBase58(), bot);
            const userPair = getKeyPair('keypair.json');
            // console.log(user.id)
            // const mainPair = getKeyPair(0);
            // const userPrivateKey = getKeyPair(0).secretKey;
            // const signerKeyPair = Keypair.fromSecretKey(userPrivateKey);
            const response = yield fetch("https://pumpportal.fun/api/trade-local", {
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
                const data = yield response.arrayBuffer();
                const tx = web3_js_1.VersionedTransaction.deserialize(new Uint8Array(data));
                console.log(userPair);
                const { blockhash } = yield exports.CONNECTION.getLatestBlockhash();
                tx.message.recentBlockhash = blockhash;
                tx.sign([userPair]);
                // Send the transaction to the Solana network
                try {
                    const signature = yield exports.CONNECTION.sendTransaction(tx);
                    const confirmation = yield exports.CONNECTION.confirmTransaction(signature, 'confirmed');
                    if (confirmation.value.err) {
                        console.error("Transaction failed:", confirmation.value.err);
                        const transactionDetails = yield exports.CONNECTION.getTransaction(signature);
                        const logs = (_a = transactionDetails === null || transactionDetails === void 0 ? void 0 : transactionDetails.meta) === null || _a === void 0 ? void 0 : _a.logMessages;
                        if (logs && logs.length > 0) {
                            console.error("Transaction logs:", logs);
                            yield bot.telegram.sendMessage(chatId, `❌ Transaction failed: ${confirmation.value.err}. Logs: ${logs.join(', ')}`);
                        }
                        else {
                            console.error("No logs available for this transaction.");
                            yield bot.telegram.sendMessage(chatId, `❌ Transaction failed: ${confirmation.value.err}. No logs available.`);
                        }
                    }
                    else {
                        yield bot.telegram.sendMessage(chatId, `✅ Successfully bought ${amount} tokens (mint: ${mint}). Transaction: https://solscan.io/tx/${signature}`);
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
                }
                catch (sendTransactionError) {
                    if (sendTransactionError instanceof Error) {
                        console.error("SendTransactionError:", sendTransactionError.message);
                        // await bot.telegram.sendMessage(
                        //     chatId,
                        //     `❌ Transaction failed with error: ${sendTransactionError.message}`
                        // );
                    }
                    else {
                        console.error("Unknown SendTransactionError:", sendTransactionError);
                        // await bot.telegram.sendMessage(
                        //     chatId,
                        //     `❌ Transaction failed with an unknown error.`
                        // );
                    }
                }
            }
            else {
                const errorText = yield response.text();
                console.error("API Error:", errorText);
                // await bot.telegram.sendMessage(
                //     chatId,
                //     `❌ Failed to process the transaction: ${response.statusText}`
                // );
                return false;
            }
        }
        catch (error) {
            if (error instanceof Error) {
                console.error("Error buying token:", error.message);
                // await bot.telegram.sendMessage(
                //     chatId,
                //     `❌ Error occurred while buying token: ${error.message} ${SendTransactionError}`
                // );
            }
            else {
                console.error("Unknown error:", error);
                yield bot.telegram.sendMessage(chatId, "❌ Unknown error occurred.");
            }
            return false;
        }
    });
}
function sellToken(token_1, amount_1, bot_1, chatId_1) {
    return __awaiter(this, arguments, void 0, function* (token, amount, bot, chatId, retries = 3) {
        // const user = await db.user.findUnique({ where: { uuid: String(chatId) } });
        var _a;
        // if (!user || !user.pubKey) {
        //     await bot.telegram.sendMessage(
        //         chatId,
        //         "❌ User not found or required keys are missing."
        //     );
        //     return false;
        // }
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                yield balanceCommand(token, bot, chatId);
                const isUser = getKeyPair('keypair.json');
                yield getSOLBalance(chatId, isUser.publicKey.toBase58(), bot);
                const userPair = getKeyPair('keypair.json');
                const trade = tradeHistory.find((t) => t.token === token);
                yield bot.telegram.sendMessage(chatId, `✅ ${token} ${trade}`);
                // if (trade) {
                // Decode the private key from the selected wallet (assumed to be in base58 format)
                // const privateKey = bs58.decode(selectedWallet);
                // const signerKeyPair = Keypair.fromSecretKey(privateKey);
                const response = yield fetch('https://pumpportal.fun/api/trade-local', {
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
                    const data = yield response.arrayBuffer();
                    const tx = web3_js_1.VersionedTransaction.deserialize(new Uint8Array(data));
                    console.log(userPair);
                    const { blockhash } = yield exports.CONNECTION.getLatestBlockhash();
                    tx.message.recentBlockhash = blockhash;
                    tx.sign([userPair]);
                    // Send the transaction to the Solana network
                    const signature = yield exports.CONNECTION.sendTransaction(tx);
                    const confirmation = yield exports.CONNECTION.confirmTransaction(signature, 'confirmed');
                    if (confirmation.value.err) {
                        console.error("Transaction failed:", confirmation.value.err);
                        const transactionDetails = yield exports.CONNECTION.getTransaction(signature);
                        const logs = (_a = transactionDetails === null || transactionDetails === void 0 ? void 0 : transactionDetails.meta) === null || _a === void 0 ? void 0 : _a.logMessages;
                        if (logs && logs.length > 0) {
                            console.error("Transaction logs:", logs);
                            yield bot.telegram.sendMessage(chatId, `❌ Transaction failed: ${confirmation.value.err}. Logs: ${logs.join(', ')}`);
                        }
                        else {
                            console.error("No logs available for this transaction.");
                            yield bot.telegram.sendMessage(chatId, `❌ Transaction failed: ${confirmation.value.err}. No logs available.`);
                        }
                    }
                    else {
                        yield bot.telegram.sendMessage(chatId, `✅ Successfully sold ${amount} of tokens (mint: ${token}) after 20 seconds!. Transaction: https://solscan.io/tx/${signature}`);
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
                }
                else {
                    const errorText = yield response.text();
                    console.error("API Error:", errorText);
                    throw new Error(`Failed to process the transaction: ${response.statusText}`);
                }
                // }
            }
            catch (error) {
                if (error instanceof Error) {
                    console.error(`Attempt ${attempt} - Error selling token:`, error.message);
                    if (attempt === retries) {
                        yield bot.telegram.sendMessage(chatId, `❌ Error occurred while selling token: ${error.message}`);
                    }
                }
                else {
                    console.error(`Attempt ${attempt} - Unknown error:`, error);
                    if (attempt === retries) {
                        yield bot.telegram.sendMessage(chatId, "❌ Unknown error occurred.");
                    }
                }
            }
        }
        return false;
    });
}
function monitorAndTrade(bot) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const newTokens = yield fetchNewTokens();
            console.log('New tokens detected:', newTokens);
            // Insert new tokens into the tokens table
            for (const token of newTokens) {
                // await db.token.create({
                //     data: {
                //         mint: token.mint,
                //         name: token.name,
                //         price: 0,
                //         processed: false, // Add the processed field
                //     },
                // });
                console.log(`🚀 Added new token to database: ${token.name} (${token.mint})`);
            }
            // Retrieve all unprocessed tokens from the tokens table
            // const unprocessedTokens = await db.token.findMany({
            //     where: { processed: false },
            // });
            const token = newTokens[0];
            console.log(`🚀 Monitoring token from database: ${token.name} (${token.mint})`);
            yield bot.telegram.sendMessage("7170406919", `🚀 Monitoring token from database: ${token.name} (${token.mint})`);
            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                const buySuccess = yield buyToken(token.mint, 350000, 10, bot, "7170406919");
                console.log(buySuccess);
                // if (buySuccess) {
                tradeHistory.push({ token: token.mint, action: 'buy', amount: 350000, buyPrice: 1.0 });
                // Mark the token as processed in the database
                // await db.token.update({
                //     where: { mint: token.mint },
                //     data: { processed: true },
                // });
                // Add a 20-second delay before attempting to sell
                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    yield sellToken(token.mint, 350000, bot, "7170406919"); // Assuming 1.2 as the current price
                }), 3000); // 20 seconds in milliseconds
                // }
            }), 60000); // 20 seconds in milliseconds
            // }
        }
        catch (error) {
            console.error('Error monitoring tokens:', error);
        }
    });
}
// Start monitoring
(() => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Starting token monitoring...');
    setInterval(() => { monitorAndTrade(bot); }, 80000); // Monitor every 30 seconds
    bot.launch();
}))();
