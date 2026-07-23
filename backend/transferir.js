const { JsonRpcProvider, formatEther, parseEther } = require("ethers");

const RPC_URL = "http://127.0.0.1:9566";
const provider = new JsonRpcProvider(RPC_URL);

// Dirección de destino del laboratorio
const DIRECCION_DESTINO = "0x0cdb1021a06e21f30410d9b9239616408975724f";

async function main() {
    try {
        console.log("⏳ Conectando a la red privada de Ethereum en Docker...");
        
        // 1. Obtener la lista de cuentas creadas por el entorno de desarrollo de Geth
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length === 0) {
            console.log("❌ No se encontraron cuentas de desarrollo en el contenedor.");
            return;
        }
        
        const cuentaDesarrollo = accounts[0];
        console.log(`💎 Cuenta millonaria de Docker detectada: ${cuentaDesarrollo}`);

        // 2. Consultar el saldo inicial de esa cuenta millonaria
        const saldoInicial = await provider.getBalance(cuentaDesarrollo);
        console.log(`💰 Saldo Inicial de Desarrollo: ${formatEther(saldoInicial)} ETH`);

        const montoEnvio = parseEther("10.0");
        console.log(`💸 Enviando 10 ETH desde Docker a: ${DIRECCION_DESTINO}...`);

        // 3. Transferir enviando la transacción directa para que el nodo la firme internamente
        const txHash = await provider.send("eth_sendTransaction", [{
            from: cuentaDesarrollo,
            to: DIRECCION_DESTINO,
            value: "0x8ac7230489e80000", // 10 ETH en hexadecimal obligatorio para llamadas RPC puras
            gas: "0x5208" // Gas limit estándar de 21000
        }]);

        console.log(`🔄 Transacción procesada por RPC. Hash: ${txHash}`);
        console.log("⏳ Esperando asentamiento de bloque...");

        // 4. Verificar la recepción del saldo en tu cuenta destino
        setTimeout(async () => {
            const saldoDestino = await provider.getBalance(DIRECCION_DESTINO);
            console.log(`✅ ¡Saldo verificado en cuenta destino!: ${formatEther(saldoDestino)} ETH`);
        }, 2000);

    } catch (error) {
        console.error("❌ Error en la ejecución de la transferencia:", error);
    }
}

main();
