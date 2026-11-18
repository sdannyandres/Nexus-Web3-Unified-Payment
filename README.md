# Nexus Web3 Unified Payment

Orquestador de pagos **no custodial** sobre EVM: backend Node.js (ethers.js v6, BigInt) que gestiona una red Ethereum privada con Geth (consenso Clique PoA) y un frontend React + Vite.

**Estado:** en desarrollo. Aún no incluye contratos desplegados ni pruebas automatizadas.

## Qué hace
- Conecta por JSON-RPC a nodos Geth con ethers.js v6.
- Usa aritmética BigInt para balances.
- Crea y arranca nodos Geth desde `backend/router-network.js`.
- Soporta un proveedor inyectado (por ejemplo MetaMask) en el frontend.

## Arranque rápido (red local de desarrollo)
```bash
cd backend && npm install
export GETH_PASSWORD="<elige-una-contraseña-local>"   # nunca la subas al repo
node app.js
cd ../frontend && npm install && npm run dev
```

## Seguridad
- La contraseña de la cuenta de desarrollo se lee de `GETH_PASSWORD`; no hay credenciales en el código.
- Es una red de desarrollo. No usar con fondos reales.

## Hoja de ruta
- [ ] Contrato de escrow con pruebas (Hardhat) y despliegue en Sepolia
- [ ] Docker Compose para Geth + backend + frontend
- [ ] CI con pruebas
- [ ] Licencia (a elegir por el autor)
