
const express = require("express");
const router = express.Router();
const fs = require("fs");
const os = require("os");
const path = require("path");
const { exec, execSync, spawn, spawnSync } = require("child_process");

module.exports = router;

const PASSWORD = "123456";
const BALANCE = "0x200000000000000000000000000000000000000000000000000000000000000";
const MICUENTA = "704765a908962e25626f2bea8cdf96c84dedaa0b";

function launchNode(NUMERO_NETWORK, NUMERO_NODO, DIR_NODE, NETWORK_DIR,
    IPCPATH, NETWORK_CHAINID, HTTP_PORT, CUENTA, PORT,
    AUTHRPC_PORT, BALANCE, CUENTAS_ALLOC) {

    const out2 = fs.openSync(`./${DIR_NODE}/outNodo.log`, 'a');
    const err2 = fs.openSync(`./${DIR_NODE}/outNodo.log`, 'a');
    
    // Parámetros actualizados para Geth >= 1.13 en 2026
    const params = [
        "--networkid", NETWORK_CHAINID,
        '--mine',
        '--miner.etherbase', CUENTA, // Reemplaza de forma segura el unlock por HTTP obsoletos
        '--syncmode', 'full',
        '--datadir', DIR_NODE,
        '--http', 
        '--http.corsdomain', '*', 
        '--http.port', HTTP_PORT, 
        '--http.api', 'clique,admin,eth,miner,net,txpool,web3', // Removido 'personal' (deprecado)
        '--port', PORT,
        '--authrpc.port', AUTHRPC_PORT,
        '--ipcpath', IPCPATH,
        '--nodiscover'
        // Eliminados --allow-insecure-unlock, --unlock, --graphql y --trace (no estándares o removidos)
    ];

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
    
    // Guardamos solo los datos serializables. Guardar el objeto ChildProcess directo causaba bugs.
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
    
    // Corrección crítica A-01: Rutas IPC dinámicas para Linux y Windows
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
        // Si falla process.kill (común en Linux con huerfanos), forzamos vía bash
        try { execSync(`kill -9 ${pid}`); } catch (e) {}
    }
}

function createAccount(DIR_NODE) {
    createIfNotExists(DIR_NODE);
    fs.writeFileSync(`${DIR_NODE}/pwd`, PASSWORD);
    execSync(`geth --datadir ${DIR_NODE} account new --password ${DIR_NODE}/pwd`);

    const lista = fs.readdirSync(`${DIR_NODE}/keystore`);
    const cuentaData = JSON.parse(fs.readFileSync(`${DIR_NODE}/keystore/${lista[0]}`).toString());
    return cuentaData.address.startsWith("0x") ? cuentaData.address : `0x${cuentaData.address}`;
}

function generateGenesis(NETWORK_CHAINID, CUENTA, BALANCE, CUENTAS_ALLOC, NETWORK_DIR) {
    let genesis = JSON.parse(fs.readFileSync('genesisbase.json').toString());

    genesis.config.chainId = NETWORK_CHAINID;
    
    // Formatear dirección limpia sin '0x' para el extraData de Clique
    const cleanAddress = CUENTA.replace("0x", "").toLowerCase();
    genesis.extraData = `0x${'0'.repeat(64)}${cleanAddress}${'0'.repeat(130)}`;

    genesis.alloc = {};
    CUENTAS_ALLOC.forEach(item => {
        const cleanItem = item.startsWith("0x") ? item.toLowerCase() : `0x${item.toLowerCase()}`;
        genesis.alloc[cleanItem] = { balance: BALANCE };
    });

    fs.writeFileSync(`${NETWORK_DIR}/genesis.json`, JSON.stringify(genesis, null, 4));
}

router.post("/create/:network/:node", (req, res) => {
    const NUMERO_NETWORK = parseInt(req.params.network);
    const NUMERO_NODO = parseInt(req.params.node);
    const parametros = generateParameter(NUMERO_NETWORK, NUMERO_NODO);

    const { NETWORK_DIR, DIR_NODE, NETWORK_CHAINID, AUTHRPC_PORT, HTTP_PORT, PORT, IPCPATH } = parametros;

    createIfNotExists("ETH");
    deleteIfExists(NETWORK_DIR); // Solo el nodo 1 limpia la red entera
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

    // Corrección A-04: Elimina SOLO el directorio del nodo nuevo, NO la red entera
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
    
    // 1. Leer configuraciones antiguas y matar procesos activos
    const antiguosConfig = [];
    nodos.forEach(i => {
        try {
            const configPath = `${NETWORK_DIR}/${i.name}/paramsNodo.json`;
            const data = JSON.parse(fs.readFileSync(configPath));
            antiguosConfig.push(data);
            killProcess(data.pid);
        } catch (error) {}
    });

    // 2. Generar el archivo static-nodes.json con enodes válidos
    const enodes = antiguosConfig.map(item => {
        try {
            const nodekeyHex = fs.readFileSync(`${item.nodo.dir_node}/geth/nodekey`).toString().trim();
            // Ejecución segura de bootnode en Linux
            const addressStdout = spawnSync('bootnode', ['-nodekeyhex', nodekeyHex, '-writeaddress']);
            const nodeAddress = addressStdout.stdout.toString().trim();
            return `enode://${nodeAddress}@127.0.0.1:${item.nodo.port}?discport=0`;
        } catch (e) {
            return null;
        }
    }).filter(e => e !== null);

        // Escribir static-nodes en cada uno de los nodos para forzar el Discovery manual
    antiguosConfig.forEach(item => {
        try {
            fs.writeFileSync(`${item.nodo.dir_node}/static-nodes.json`, JSON.stringify(enodes, null, 4));
        } catch (e) {}
    });

    // 3. Relanzar todos los nodos
    const relanzados = antiguosConfig.map(item => {
        return launchNode(
            item.nodo.network, item.nodo.nodo, item.nodo.dir_node, item.nodo.network_dir,
            item.nodo.ipcpath, item.nodo.chainId, item.nodo.http_port, item.nodo.address,
            item.nodo.port, item.nodo.authRpcPort, item.nodo.prefund, []
        );
    });

    res.send({ status: "reloaded", nodes: relanzados });
});
