"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidAddress = exports.Transaction = exports.getPublicKey = exports.getCoinbaseTransaction = exports.TxOut = exports.TxIn = exports.UnspentTxOut = exports.getTransactionId = exports.signTxIn = exports.processTransactions = void 0;
const crypto_js_1 = __importDefault(require("crypto-js"));
const lodash_1 = __importDefault(require("lodash"));
const ecdsa = __importStar(require("elliptic"));
const ec = new ecdsa.ec("secp256k1");
const COINBASE_AMOUNT = 50;
class TxOut {
    constructor(address, amount) {
        this.address = address;
        this.amount = amount;
    }
}
exports.TxOut = TxOut;
class TxIn {
}
exports.TxIn = TxIn;
class Transaction {
}
exports.Transaction = Transaction;
class UnspentTxOut {
    constructor(txOutId, txOutIndex, address, amount) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}
exports.UnspentTxOut = UnspentTxOut;
const getTransactionId = (transaction) => {
    const txInContent = transaction.txIns
        .map((txIn) => txIn.txOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b, "");
    const txOutContent = transaction.txOuts
        .map((txOut) => txOut.address + txOut.amount)
        .reduce((a, b) => a + b, "");
    return crypto_js_1.default.SHA256(txInContent + txOutContent).toString();
};
exports.getTransactionId = getTransactionId;
const signTxIn = (transaction, txInIndex, privateKey, aUnspentTxOuts) => {
    const txIn = transaction.txIns[txInIndex];
    const dataToSign = transaction.id;
    const referencedUnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts);
    if (referencedUnspentTxOut == null) {
        console.log("could not find referenced txOut");
        throw new Error();
    }
    const referencedAddress = referencedUnspentTxOut.address;
    if (getPublicKey(privateKey) !== referencedAddress) {
        console.log("trying to sign an input with private key that does not match the address that is referenced in txIn");
        throw new Error();
    }
    const key = ec.keyFromPrivate(privateKey, "hex");
    const signature = toHexString(key.sign(dataToSign).toDER());
    return signature;
};
exports.signTxIn = signTxIn;
const isValidTransactionStructure = (transaction) => {
    if (typeof transaction.id !== "string") {
        console.log("transactionId missing");
        return false;
    }
    if (!(transaction.txIns instanceof Array)) {
        console.log("invalid txIns type ins transaction");
        return false;
    }
    if (!transaction.txIns.map(isValidTxInStructure).reduce((a, b) => a && b, true)) {
        return false;
    }
    if (!(transaction.txOuts instanceof Array)) {
        console.log("invalid txOuts type in transactions");
        return false;
    }
    if (!transaction.txOuts
        .map(isValidTxOutStructure)
        .reduce((a, b) => a && b, true)) {
        return false;
    }
    return true;
};
const validateTransaction = (transaction, aUnspentTxOuts) => {
    if (getTransactionId(transaction) !== transaction.id) {
        console.log("invalid tx id: " + transaction.id);
        return false;
    }
    const hasValidTxIns = transaction.txIns
        .map((txIn) => validateTxIn(txIn, transaction, aUnspentTxOuts))
        .reduce((a, b) => a && b, true);
    if (!hasValidTxIns) {
        console.log("some of the txIns are invalid in tx: " + transaction.id);
        return false;
    }
    const totalTxInValues = transaction.txIns
        .map((txIn) => getTxInAmount(txIn, aUnspentTxOuts))
        .reduce((a, b) => a + b, 0);
    const totalTxOutValues = transaction.txOuts
        .map((txOut) => txOut.amount)
        .reduce((a, b) => a + b, 0);
    if (totalTxOutValues !== totalTxInValues) {
        console.log("totalTxOutValues !== totalTxInValues in tx: " + transaction.id);
        return false;
    }
    return true;
};
const validateBlockTransactions = (aTransaction, aUnspentTxOuts, blockIndex) => {
    const coinbaseTx = aTransaction[0];
    if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        console.log("invalid coinbase transaction: " + JSON.stringify(coinbaseTx));
        return false;
    }
    // check for duplicate txIns. Each txIn can be included only once
    const txIns = lodash_1.default(aTransaction)
        .map((tx) => tx.txIns)
        .flatten()
        .value();
    if (hasDuplicates(txIns)) {
        return false;
    }
    // all but coinbase transactions
    const normalTransactions = aTransaction.slice(1);
    return normalTransactions
        .map((tx) => validateTransaction(tx, aUnspentTxOuts))
        .reduce((a, b) => a && b, true);
};
const hasDuplicates = (txIns) => {
    const groups = lodash_1.default.countBy(txIns, (txIn) => txIn.txOutId + txIn.txOutId);
    return lodash_1.default(groups)
        .map((value, key) => {
        if (value > 1) {
            console.log("duplicate txIn: " + key);
            return true;
        }
        else {
            return false;
        }
    })
        .includes(true);
};
const validateTxIn = (txIn, transaction, aUnspentTxOuts) => {
    //   check double validation
    const referencedUTxOut = aUnspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutId === txIn.txOutId);
    if (referencedUTxOut == null) {
        console.log("referenced txOut not found: " + JSON.stringify(txIn));
        return false;
    }
    const address = referencedUTxOut.address;
    const key = ec.keyFromPublic(address, "hex");
    return key.verify(transaction.id, txIn.signature);
};
const isValidTransactionsStructure = (transactions) => {
    return transactions
        .map(isValidTransactionStructure)
        .reduce((a, b) => a && b, true);
};
const getTxInAmount = (txIn, aUnspentTxOuts) => {
    return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
};
const findUnspentTxOut = (transactionId, index, aUnspentTxOuts) => {
    return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index);
};
const validateCoinbaseTx = (transaction, blockIndex) => {
    if (transaction == null) {
        console.log("the first transaction in the block must be coinbase transaction");
        return false;
    }
    if (getTransactionId(transaction) !== transaction.id) {
        console.log("invalid coinbase tx id: " + transaction.id);
        return false;
    }
    if (transaction.txIns.length !== 1) {
        console.log("one txIn must be specified in the coinbase transaction");
        return false;
    }
    if (transaction.txIns[0]?.txOutIndex !== blockIndex) {
        console.log("the txIn index in coinbase tx must be the block height");
        return false;
    }
    if (transaction.txOuts.length !== 1) {
        console.log("invalid number of txOuts in coinbase transaction");
        return false;
    }
    if (transaction.txOuts[0]?.amount != COINBASE_AMOUNT) {
        console.log("invalid coinbase amount in coinbase transaction");
        return false;
    }
    return true;
};
const getCoinbaseTransaction = (address, blockIndex) => {
    const t = new Transaction();
    const txIn = new TxIn();
    txIn.signature = "";
    txIn.txOutId = "";
    txIn.txOutIndex = blockIndex;
    t.txIns = [txIn];
    t.txOuts = [new TxOut(address, COINBASE_AMOUNT)];
    t.id = getTransactionId(t);
    return t;
};
exports.getCoinbaseTransaction = getCoinbaseTransaction;
const updateUnspentTxOuts = (newTransactions, aUnspentTxOuts) => {
    const newUnspentTxOuts = newTransactions
        .map((t) => {
        return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount));
    })
        .reduce((a, b) => a.concat(b), []);
    const consumedTxOuts = newTransactions
        .map((t) => t.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));
    const resultingUnspentTxOuts = aUnspentTxOuts
        .filter((uTxO) => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts))
        .concat(newUnspentTxOuts);
    return resultingUnspentTxOuts;
};
const processTransactions = (aTransactions, aUnspentTxOuts, blockIndex) => {
    if (!isValidTransactionsStructure(aTransactions)) {
        return null;
    }
    if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
        console.log("invalid block transactions");
        return null;
    }
    return updateUnspentTxOuts(aTransactions, aUnspentTxOuts);
};
exports.processTransactions = processTransactions;
const toHexString = (byteArray) => {
    return Array.from(byteArray, (byte) => {
        return ("0" + (byte & 0xff).toString(16)).slice(-1);
    }).join("");
};
const getPublicKey = (aPrivateKey) => {
    return ec.keyFromPrivate(aPrivateKey, "hex").getPublic().encode("hex", false); //chech compact
};
exports.getPublicKey = getPublicKey;
const isValidTxInStructure = (txIn) => {
    if (txIn == null) {
        console.log("txIn is null");
        return false;
    }
    else if (typeof txIn.signature !== "string") {
        console.log("invalid signature type in txIn");
        return false;
    }
    else if (typeof txIn.txOutId !== "string") {
        console.log("invalid txOutId type in txIn");
        return false;
    }
    else if (typeof txIn.txOutIndex !== "number") {
        console.log("invalid txOutIndex type in txIn");
        return false;
    }
    else {
        return true;
    }
};
const isValidTxOutStructure = (txOut) => {
    if (txOut == null) {
        console.log("txOut is null");
        return false;
    }
    else if (typeof txOut.address !== "string") {
        console.log("invalid address type in txOut");
        return false;
    }
    else if (!isValidAddress(txOut.address)) {
        console.log("invalid txOut address");
        return false;
    }
    else if (typeof txOut.amount !== "number") {
        console.log("invalid amount type in txOut");
        return false;
    }
    else {
        return true;
    }
};
const isValidAddress = (address) => {
    if (address.length !== 130) {
        console.log("invalid public key length");
        return false;
    }
    else if (address.match("^[a-fA-F0-9]+$") === null) {
        console.log("public key must contain only hex characters");
        return false;
    }
    else if (!address.startsWith("04")) {
        console.log("public key must start with 04");
        return false;
    }
    return true;
};
exports.isValidAddress = isValidAddress;
