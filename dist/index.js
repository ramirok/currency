"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const blockchain_1 = require("./blockchain");
const p2p_1 = require("./p2p");
const transactionPool_1 = require("./transactionPool");
const wallet_1 = require("./wallet");
const httpPort = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort = parseInt(process.env.P2P_PORT) || 6001;
const initHttpServer = (myHttpPort) => {
    const app = express_1.default();
    app.use(express_1.default.json());
    app.use((err, _req, res, _next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });
    app.get("/blocks", (_req, res) => {
        res.send(blockchain_1.getBlockchain());
    });
    app.get("unspentTransactionsOutputs", (_req, res) => {
        res.send(blockchain_1.getUnspentTxOuts());
    });
    app.get("/myUnspentTransactionOutputs", (_req, res) => {
        res.send(blockchain_1.getMyUnspentTransactionOutputs());
    });
    app.post("/mineRawBlock", (req, res) => {
        if (req.body.data == null) {
            res.send("data parameter is missing");
            return;
        }
        const newBlock = blockchain_1.generateRawNextBlock(req.body.data);
        if (newBlock === null) {
            res.status(400).send("could not generate block");
        }
        else {
            res.send(newBlock);
        }
    });
    app.post("/mineBlock", (_req, res) => {
        const newBlock = blockchain_1.generateNextBlock();
        if (newBlock === null) {
            res.status(400).send("could not generate block");
        }
        else {
            res.send(newBlock);
        }
    });
    app.get("/balance", (_req, res) => {
        const balance = blockchain_1.getAccountBalance();
        res.send({ balance });
    });
    app.get("/address", (_req, res) => {
        const address = wallet_1.getPublicFromWallet();
        res.send({ address });
    });
    app.post("/mineTransaction", (req, res) => {
        const address = req.body.address;
        const amount = req.body.amount;
        try {
            const resp = blockchain_1.generatenextBlockWithTransactions(address, amount);
            res.send(resp);
        }
        catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });
    app.post("/sendTransaction", (req, res) => {
        try {
            const address = req.body.address;
            const amount = req.body.amount;
            if (address === undefined || amount === undefined) {
                throw new Error("invalid address or amount");
            }
            const resp = blockchain_1.sendTransaction(address, amount);
            res.send(resp);
        }
        catch (error) {
            console.log(error.message);
            res.status(400).send(error.message);
        }
    });
    app.get("/transactionPool", (_req, res) => {
        res.send(transactionPool_1.getTransactionPool());
    });
    app.get("/peers", (_req, res) => {
        res.send(p2p_1.getSockets().map((s) => `${s._socket.remoteAddress}:${s._socket.remotePort}`));
    });
    app.post("/addPeer", (req, res) => {
        p2p_1.connectToPeers(req.body.peer);
        res.send();
    });
    app.post("/stop", (_req, res) => {
        res.send({ msg: "stopping server" });
        process.exit();
    });
    app.listen(myHttpPort, () => {
        console.log("Listening http on port: " + myHttpPort);
    });
};
initHttpServer(httpPort);
p2p_1.initP2PServer(p2pPort);
wallet_1.initWallet();
