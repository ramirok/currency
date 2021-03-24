"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const blockchain_1 = require("./blockchain");
const p2p_1 = require("./p2p");
const httpPort = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort = parseInt(process.env.P2P_PORT) || 6001;
const initHttpServer = (myHttpPort) => {
    const app = express_1.default();
    app.use(express_1.default.json());
    app.get("/blocks", (_req, res) => {
        res.send(blockchain_1.getBlockchain());
    });
    app.post("/mineBlock", (req, res) => {
        const newBlock = blockchain_1.generateNextBlock(req.body.data);
        res.send(newBlock);
    });
    app.get("/peers", (_req, res) => {
        res.send(p2p_1.getSockets().map((s) => `${s._socket.remoteAddress}:${s.socket.remotePort}`));
    });
    app.post("/addPeer", (req, res) => {
        p2p_1.connectToPeers(req.body.peer);
        res.send();
    });
    app.listen(myHttpPort, () => {
        console.log("Listening http on port: " + myHttpPort);
    });
};
initHttpServer(httpPort);
p2p_1.initP2PServer(p2pPort);
