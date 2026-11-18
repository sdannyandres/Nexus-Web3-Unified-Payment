const express = require("express");
const router = express.Router();
const fs = require("fs");
const os = require("os");
const path = require("path");
const { exec, execSync, spawn } = require("child_process");

const PASSWORD = process.env.GETH_PASSWORD || (() => { throw new Error("Define GETH_PASSWORD"); })();
const BALANCE = "0x200000000000000000000000000000000000000000000000000000000000000";
const MICUENTA = "704765a908962e25626f2bea8cdf96c84dedaa0b";

// --- FUNCIONES AUXILIARES DE ORQUESTACIÓN DE INFRAESTRUCTURA ---

function launchNode(NUMERO_NETWORK, NUMERO_NODO, DIR_NODE, NETWORK_DIR,
    IPCPATH, NETWORK_CHAINID, HTTP_PORT, CUENTA, PORT,
    AUTHRPC_PORT, BALANCE, CUENTAS_ALLOC) {

    const out2 = fs.openSync(`./${DIR_NODE}/outNodo.log`, 'a');
    const err2 = fs.openSync(`./${DIR_NODE}/outNodo.log`, 'a');
    
    const params = [
        "--networkid", NETWORK_CHAINID,
        '--syncmode', 'full',
        '--datadir', DIR_NODE,
        '--http', 
        '--http.corsdomain', '*', 
        '--http.port', HTTP_PORT, 
        '--http.api', 'clique,admin,eth,miner,net,txpool,web3', 
        '--port', PORT,
        '--authrpc.port', AUTHRPC_PORT,
        '--ipcdisable', 
        '--nodiscover',
        '--db.engine', 'leveldb',
        '--state.scheme', 'path'
    ];

    if (parseInt(NUMERO_NODO) === 1) {
        params.push('--mine');
        params.push('--miner.etherbase');
        params.push(CUENTA);
    }

    const nodo = {
        network: NUMERO_NETWORK,
        nodo: NUMERO_NODO,
        network_dir: NETWORK_DIR,
        dir_node: DIR_NODE,
        port: PORT,
        http_port: HTTP_PORT,
        ipcpath: IPCPATH,
        address: CUENTA,
        chainId: NETWORK_CHAINID,
        authRpcPort: AUTHRPC_PORT,
        prefund: BALANCE
    };

    const subproceso2 = spawn('geth', params, { detached: true, stdio: ['ignore', out2, err2] });
    
    fs.writeFileSync(`${DIR_NODE}/paramsNodo.json`, JSON.stringify({ nodo, pid: subproceso2.pid }, null, 4));
    
    subproceso2.unref();
    return { nodo, pid: subproceso2.pid };
}

function generateParameter(network, node) {
    const NUMERO_NETWORK = parseInt(network);
    const NUMERO_NODO = parseInt(node);
    const NODO = `nodo${NUMERO_NODO}`;
    const NETWORK_DIR = `ETH/eth${NUMERO_NETWORK}`;
    const NETWORK_CHAINID = 333444 + NUMERO_NETWORK;

    const HTTP_PORT = 9545 + NUMERO_NODO + NUMERO_NETWORK * 20;
    const DIR_NODE = `${NETWORK_DIR}/${NODO}`;
    
    const IPC_FILENAME = `geth.ipc`;
    const IPCPATH = os.platform() === 'win32'
        ? `\\\\.\\pipe\\eth${NUMERO_NETWORK}_nodo${NUMERO_NODO}_${IPC_FILENAME}`
        : path.join(process.cwd(), DIR_NODE, IPC_FILENAME);

    const PORT = 30404 + NUMERO_NODO + NUMERO_NETWORK * 20;
    const AUTHRPC_PORT = 9553 + NUMERO_NODO + NUMERO_NETWORK * 20;

    return {
        NUMERO_NETWORK, NUMERO_NODO, NODO, NETWORK_DIR, NETWORK_CHAINID, HTTP_PORT,
        DIR_NODE, IPCPATH, PORT, AUTHRPC_PORT
    };
}

function createIfNotExists(pathDir) {
    if (!fs.existsSync(pathDir))
        fs.mkdirSync(pathDir, { recursive: true });
}

function deleteIfExists(pathDir) {
    if (fs.existsSync(pathDir))
        fs.rmdirSync(pathDir, { recursive: true });
}

function killProcess(pid) {
    if (!pid) return;
    try {
        process.kill(pid, 'SIGTERM');
    } catch (error) {
        try { execSync(`kill -9 ${pid}`); } catch (e) {}
    }
}

function createAccount(DIR_NODE) {
    createIfNotExists(DIR_NODE);
    fs.writeFileSync(`${DIR_NODE}/pwd`, PASSWORD);
    execSync(`geth --datadir ${DIR_NODE} account new --password ${DIR_NODE}/pwd`);

    const lista = fs.readdirSync(`${DIR_NODE}/keystore`);
    const cuentaData = JSON.parse(fs.readFileSync(`${DIR_NODE}/keystore/${lista}`).toString());
    return cuentaData.address.startsWith("0x") ? cuentaData.address : `0x${cuentaData.address}`;
}

function generateGenesis(NETWORK_CHAINID, CUENTA, BALANCE, CUENTAS_ALLOC, NETWORK_DIR) {
    let genesis = JSON.parse(fs.readFileSync('genesisbase.json').toString());

    genesis.config.chainId = NETWORK_CHAINID;
    
    const cleanAddress = CUENTA.replace("0x", "").toLowerCase();
    genesis.extraData = `0x${'0'.repeat(64)}${cleanAddress}${'0'.repeat(130)}`;

    genesis.alloc = {};
    CUENTAS_ALLOC.forEach(item => {
        const cleanItem = item.startsWith("0x") ? item.toLowerCase() : `0x${item.toLowerCase()}`;
        genesis.alloc[cleanItem] = { balance: BALANCE };
    });

    fs.writeFileSync(`${NETWORK_DIR}/genesis.json`, JSON.stringify(genesis, null, 4));
}

// --- ENDPOINTS ---

router.post("/create/:network/:node", (req, res) => {
    const NUMERO_NETWORK = parseInt(req.params.network);
    const NUMERO_NODO = parseInt(req.params.node);
    const parametros = generateParameter(NUMERO_NETWORK, NUMERO_NODO);

    const { NETWORK_DIR, DIR_NODE, NETWORK_CHAINID, AUTHRPC_PORT, HTTP_PORT, PORT, IPCPATH } = parametros;

    createIfNotExists("ETH");
    deleteIfExists(NETWORK_DIR); 
    createIfNotExists(NETWORK_DIR);
    createIfNotExists(DIR_NODE);

    const CUENTA = createAccount(DIR_NODE);
    const CUENTAS_ALLOC = [CUENTA, MICUENTA];

    generateGenesis(NETWORK_CHAINID, CUENTA, BALANCE, CUENTAS_ALLOC, NETWORK_DIR);

    const comando = `geth --datadir ${DIR_NODE} init ${NETWORK_DIR}/genesis.json`;

    exec(comando, (error) => {
        if (error) {
            return res.status(500).send({ error: error.message });
        }
        const resultado = launchNode(NUMERO_NETWORK, NUMERO_NODO, DIR_NODE,
            NETWORK_DIR, IPCPATH, NETWORK_CHAINID,
            HTTP_PORT, CUENTA, PORT, AUTHRPC_PORT, BALANCE, CUENTAS_ALLOC);

        res.send(resultado);
    });
});

router.post("/add/:network/:node", (req, res) => {
    const NUMERO_NETWORK = parseInt(req.params.network);
    const NUMERO_NODO = parseInt(req.params.node);
    const parametros = generateParameter(NUMERO_NETWORK, NUMERO_NODO);

    const { NETWORK_DIR, DIR_NODE, NETWORK_CHAINID, AUTHRPC_PORT, HTTP_PORT, PORT, IPCPATH } = parametros;

    deleteIfExists(DIR_NODE);
    createIfNotExists(DIR_NODE);

    const CUENTA = createAccount(DIR_NODE);
    const CUENTAS_ALLOC = [CUENTA];

    if (!fs.existsSync(`${NETWORK_DIR}/genesis.json`)) {
        return res.status(400).send({ error: "La red base no existe. Usa /create primero." });
    }

    const comando = `geth --datadir ${DIR_NODE} init ${NETWORK_DIR}/genesis.json`;

    exec(comando, (error) => {
        if (error) {
            return res.status(500).send({ error: error.message });
        }
        const resultado = launchNode(NUMERO_NETWORK, NUMERO_NODO, DIR_NODE,
            NETWORK_DIR, IPCPATH, NETWORK_CHAINID,
            HTTP_PORT, CUENTA, PORT, AUTHRPC_PORT, BALANCE, CUENTAS_ALLOC);
        res.send(resultado);
    });
});

router.delete("/:network", (req, res) => {
    const NUMERO_NETWORK = parseInt(req.params.network);
    const NETWORK_DIR = `ETH/eth${NUMERO_NETWORK}`;
    
    if (!fs.existsSync(NETWORK_DIR)) {
        return res.send({ message: "La red no existe", network: NUMERO_NETWORK });
    }

    const nodos = fs.readdirSync(NETWORK_DIR, { withFileTypes: true }).filter(i => !i.isFile());
    
    nodos.forEach(i => {
        try {
            const data = JSON.parse(fs.readFileSync(`${NETWORK_DIR}/${i.name}/paramsNodo.json`));
            killProcess(data.pid);
        } catch (error) {}
    });

    deleteIfExists(NETWORK_DIR);
    res.send({ network: NUMERO_NETWORK, status: "destroyed" });
});

router.get("/reload/:network", (req, res) => {
    const NUMERO_NETWORK = parseInt(req.params.network);
    const NETWORK_DIR = `ETH/eth${NUMERO_NETWORK}`;
    
    if (!fs.existsSync(NETWORK_DIR)) {
        return res.status(404).send({ error: "Red no encontrada" });
    }

    const nodos = fs.readdirSync(NETWORK_DIR, { withFileTypes: true }).filter(i => !i.isFile());
    const nuevosNodos = [];

    nodos.forEach(i => {
        try {
            const configPath = `${NETWORK_DIR}/${i.name}/paramsNodo.json`;
            if (fs.existsSync(configPath)) {
                const configData = JSON.parse(fs.readFileSync(configPath));
                
                killProcess(configData.pid);

                const { network, nodo, dir_node, network_dir, ipcpath, chainId, http_port, address, port, authRpcPort, prefund } = configData.nodo;

                const resultado = launchNode(
                    network, nodo, dir_node, network_dir, ipcpath, 
                    chainId, http_port, address, port, authRpcPort, prefund, []
                );
                nuevosNodos.push(resultado);
            }
        } catch (error) {
            console.error(`Error de reinicio en nodo ${i.name}:`, error.message);
        }
    });

    res.send({ status: "reloaded", network: NUMERO_NETWORK, nodos: nuevosNodos });
});

router.get("/status", (req, res) => {
    res.json({ 
        status: "Online", 
        timestamp: new Date(),
        orchestrator: true 
    });
});

module.exports = router;
