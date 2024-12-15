"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.CONNECTION = exports.db = void 0;
const telegraf_1 = require("telegraf");
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const ws_1 = __importDefault(require("ws"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
exports.db = new client_1.PrismaClient();
const bip39 = __importStar(require("bip39"));
const ed25519_hd_key_1 = require("ed25519-hd-key");
const spl_token_1 = require("@solana/spl-token");
// import {
//     createTransferInstruction,
//     getOrCreateAssociatedTokenAccount,
//   } from "@solana/spl-token";
const ws = new ws_1.default('wss://pumpportal.fun/api/data');
const MNEMONIC = process.env.MNEMONIC;
exports.CONNECTION = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("mainnet-beta"), "confirmed");
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
// Initialize Telegraf bot
const bot = new telegraf_1.Telegraf(process.env.TELEGRAM_BOT_TOKEN);
// Update the userWallets structure to store selected wallet and wallet list
const userWallets = {};
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || "https://api.devnet.solana.com";
const web3Connection = new web3_js_1.Connection(RPC_ENDPOINT, 'confirmed');
// Define trade history and active token monitoring
const tradeHistory = [];
const monitoredTokens = [];
const getKeyPair = (index) => {
    const seed = bip39.mnemonicToSeedSync(MNEMONIC, "");
    // const hd = HDKey.fromMasterSeed(seed.toString("hex"));
    const path = `m/44'/501'/${index}'/0'`;
    (0, ed25519_hd_key_1.derivePath)(path, seed.toString("hex"));
    const keypair = web3_js_1.Keypair.fromSeed((0, ed25519_hd_key_1.derivePath)(path, seed.toString("hex")).key);
    return keypair;
};
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
        const isUser = yield exports.db.user.findUnique({
            where: {
                uuid: chatId,
            },
        });
        if (isUser) {
            yield ctx.reply(`Welcome user, \nYour public key is \`${isUser.pubKey}\``, { parse_mode: "MarkdownV2" });
            return;
        }
        // Create a new user and their wallet if they do not exist
        yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const user = yield tx.user.create({
                data: {
                    uuid: String(chatId),
                },
            });
            const keypair = getKeyPair(user.id);
            const updatedUser = yield tx.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    pubKey: keypair.publicKey.toBase58(),
                },
            });
            yield ctx.reply(`Welcome user, \nYour public key is \`${updatedUser.pubKey}\``, { parse_mode: "MarkdownV2" });
        }));
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
        const user = yield exports.db.user.findUnique({ where: { uuid: String(chatId) } });
        // Check if the user exists and has a public key
        if (!user || !user.pubKey) {
            yield bot.telegram.sendMessage(chatId, "❌ Command is not valid for you.");
            return;
        }
        // Get user's public key
        const publicKey = new web3_js_1.PublicKey(user.pubKey);
        console.log("ok ooo");
        console.log(mint);
        // Get or create the associated token account
        const tokenAccount = yield (0, spl_token_1.getOrCreateAssociatedTokenAccount)(exports.CONNECTION, getKeyPair(0), new web3_js_1.PublicKey(mint), getKeyPair(user.id).publicKey);
        if (tokenAccount) {
            console.log("token account not found");
        }
        // Fetch token balance
        const tokenBalance = yield exports.CONNECTION.getTokenAccountBalance(tokenAccount.address);
        if (tokenBalance) {
            console.log("token balance not found");
        }
        // Fetch SOL balance
        const balance = yield exports.CONNECTION.getBalance(publicKey);
        if (balance) {
            console.log("balance not found");
        }
        // Send the balance to the user
        yield bot.telegram.sendMessage(chatId, `💰 Your current balance is:\n\n` +
            `SOL: ${(balance / web3_js_1.LAMPORTS_PER_SOL).toFixed(2)} SOL\n` +
            `USDT: ${tokenBalance.value.amount &&
                (parseInt(tokenBalance.value.amount) /
                    Math.pow(10, tokenBalance.value.decimals)).toFixed(2)} USDT`);
    }
    catch (error) {
        // Handle errors
        if (error instanceof Error) {
            console.error("Error fetching balance:", error.message);
            // Notify the user about the error
            yield bot.telegram.sendMessage(chatId, `❌ An error occurred while fetching your balance: ${error.message}`);
        }
        else {
            console.error("Unknown error fetching balance:", error);
            // Notify the user about an unknown error
            yield bot.telegram.sendMessage(chatId, "❌ An unknown error occurred while fetching your balance.");
        }
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
//             const signature = await web3Connection.sendTransaction(transaction);
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
            const user = yield exports.db.user.findUnique({ where: { uuid: String(chatId) } });
            if (!user || !user.pubKey) {
                yield bot.telegram.sendMessage(chatId, "❌ User not found or required keys are missing.");
                return false;
            }
            balanceCommand(mint, bot, chatId);
            const userPair = getKeyPair(user.id);
            const mainPair = getKeyPair(0);
            const userPrivateKey = getKeyPair(0).secretKey;
            const signerKeyPair = web3_js_1.Keypair.fromSecretKey(userPrivateKey);
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
                    }
                }
                catch (sendTransactionError) {
                    if (sendTransactionError instanceof Error) {
                        console.error("SendTransactionError:", sendTransactionError.message);
                        yield bot.telegram.sendMessage(chatId, `❌ Transaction failed with error: ${sendTransactionError.message}`);
                    }
                    else {
                        console.error("Unknown SendTransactionError:", sendTransactionError);
                        yield bot.telegram.sendMessage(chatId, `❌ Transaction failed with an unknown error.`);
                    }
                }
            }
            else {
                const errorText = yield response.text();
                console.error("API Error:", errorText);
                yield bot.telegram.sendMessage(chatId, `❌ Failed to process the transaction: ${response.statusText}`);
                return false;
            }
        }
        catch (error) {
            if (error instanceof Error) {
                console.error("Error buying token:", error.message);
                yield bot.telegram.sendMessage(chatId, `❌ Error occurred while buying token: ${error.message} ${web3_js_1.SendTransactionError}`);
            }
            else {
                console.error("Unknown error:", error);
                yield bot.telegram.sendMessage(chatId, "❌ Unknown error occurred.");
            }
            return false;
        }
    });
}
function sellToken(token, amount, currentPrice, bot, chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const chatIdStr = chatId.toString();
        const selectedWallet = (_a = userWallets[chatIdStr]) === null || _a === void 0 ? void 0 : _a.selectedWallet;
        if (!selectedWallet) {
            yield bot.telegram.sendMessage(chatId, '❌ No wallet selected. Please connect and select a wallet first.');
            return false;
        }
        const trade = tradeHistory.find((t) => t.token === token && t.action === 'buy');
        if (trade && currentPrice >= trade.buyPrice * 1.2) {
            try {
                // Decode the private key from the selected wallet (assumed to be in base58 format)
                const privateKey = bs58_1.default.decode(selectedWallet);
                const signerKeyPair = web3_js_1.Keypair.fromSecretKey(privateKey);
                const response = yield fetch('https://pumpportal.fun/api/trade-local', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        publicKey: signerKeyPair.publicKey.toBase58(),
                        action: 'sell',
                        mint: token,
                        denominatedInSol: 'false',
                        amount,
                        slippage: 10,
                        priorityFee: 0.00001,
                        pool: 'pump',
                    }),
                });
                if (response.status === 200) {
                    const data = yield response.arrayBuffer();
                    const transaction = web3_js_1.VersionedTransaction.deserialize(new Uint8Array(data));
                    transaction.sign([signerKeyPair]);
                    const signature = yield web3Connection.sendTransaction(transaction);
                    console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
                    yield bot.telegram.sendMessage(chatId, `✅ Successfully sold ${amount} of token: ${token} at 20% profit!`);
                    trade.sellPrice = currentPrice;
                    return true;
                }
                else {
                    console.error('Failed to sell token:', yield response.text());
                    yield bot.telegram.sendMessage(chatId, `❌ Failed to sell token: ${token}`);
                    return false;
                }
            }
            catch (error) {
                console.error('Error selling token:', error);
                yield bot.telegram.sendMessage(chatId, `❌ Failed to sell token: ${token}`);
                return false;
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
            for (const token of newTokens) {
                if (!monitoredTokens.some((t) => t.mint === token.mint)) {
                    monitoredTokens.push(token); // Add to monitoredTokens
                    console.log(`🚀 Monitoring new token: ${token.name} (${token.mint})`);
                    yield bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, `🚀 New token detected: ${token.name} (${token.mint})`);
                    const buySuccess = yield buyToken(token.mint, 1000, 10, bot, process.env.TELEGRAM_CHAT_ID);
                    if (buySuccess) {
                        tradeHistory.push({ token: token.mint, action: 'buy', amount: 1000, buyPrice: 1.0 }); // Dummy buy price
                    }
                }
            }
            // Check for sell opportunities
            for (const trade of tradeHistory.filter((t) => t.action === 'buy' && !t.sellPrice)) {
                const currentPrice = 1.2; // Replace with real price fetching logic
                yield sellToken(trade.token, trade.amount, currentPrice, bot, process.env.TELEGRAM_CHAT_ID);
            }
        }
        catch (error) {
            console.error('Error monitoring tokens:', error);
        }
    });
}
// Start monitoring
(() => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Starting token monitoring...');
    setInterval(() => monitorAndTrade(bot), 30000); // Monitor every 30 seconds
    bot.launch();
}))();
