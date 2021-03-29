import express from "express";
import {
  generateNextBlock,
  getBlockchain,
  generateRawNextBlock,
  getAccountBalance,
  generatenextBlockWithTransactions,
  getUnspentTxOuts,
  getMyUnspentTransactionOutputs,
  sendTransaction,
} from "./blockchain";
import { connectToPeers, getSockets, initP2PServer } from "./p2p";
import { getTransactionPool } from "./transactionPool";
import { getPublicFromWallet, initWallet } from "./wallet";

const httpPort: number = parseInt(process.env.HTTP_PORT as string) || 3001;
const p2pPort: number = parseInt(process.env.P2P_PORT as string) || 6001;

const initHttpServer = (myHttpPort: number) => {
  const app = express();
  app.use(express.json());

  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err) {
        res.status(400).send(err.message);
      }
    }
  );

  app.get("/blocks", (_req, res) => {
    res.send(getBlockchain());
  });

  app.get("unspentTransactionsOutputs", (_req, res) => {
    res.send(getUnspentTxOuts());
  });

  app.get("/myUnspentTransactionOutputs", (_req, res) => {
    res.send(getMyUnspentTransactionOutputs());
  });

  app.post("/mineRawBlock", (req, res) => {
    if (req.body.data == null) {
      res.send("data parameter is missing");
      return;
    }
    const newBlock = generateRawNextBlock(req.body.data);
    if (newBlock === null) {
      res.status(400).send("could not generate block");
    } else {
      res.send(newBlock);
    }
  });

  app.post("/mineBlock", (_req, res) => {
    const newBlock = generateNextBlock();
    if (newBlock === null) {
      res.status(400).send("could not generate block");
    } else {
      res.send(newBlock);
    }
  });

  app.get("/balance", (_req, res) => {
    const balance: number = getAccountBalance();
    res.send({ balance });
  });

  app.get("/address", (_req, res) => {
    const address: string = getPublicFromWallet();
    res.send({ address });
  });

  app.post("/mineTransaction", (req, res) => {
    const address = req.body.address;
    const amount = req.body.amount;
    try {
      const resp = generatenextBlockWithTransactions(address, amount);
      res.send(resp);
    } catch (e) {
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
      const resp = sendTransaction(address, amount);
      res.send(resp);
    } catch (error) {
      console.log(error.message);
      res.status(400).send(error.message);
    }
  });

  app.get("/transactionPool", (_req, res) => {
    res.send(getTransactionPool());
  });

  app.get("/peers", (_req, res) => {
    res.send(
      getSockets().map(
        (s: any) => `${s._socket.remoteAddress}:${s._socket.remotePort}`
      )
    );
  });

  app.post("/addPeer", (req, res) => {
    connectToPeers(req.body.peer);
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
initP2PServer(p2pPort);
initWallet();
