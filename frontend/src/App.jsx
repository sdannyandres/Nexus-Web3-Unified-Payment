import React, { useState, useEffect } from 'react';
import { JsonRpcProvider, formatEther, BrowserProvider, parseEther, ContractFactory } from 'ethers';

const RPC_URL = "http://127.0.0.1:9566";
const BACKEND_URL = "http://localhost:3333/api/orchestrator";
const BILLETERA_TARGET = "0x0cdb1021a06e21f30410d9b9239616408975724f";

// Bytecode y ABI mínimos para despliegues rápidos en el entorno de desarrollo
const MIN_ABI = ["constructor()", "function name() view returns (string)"];
const MIN_BYTECODE = "0x6080604052348015600f57600080fd5b50603580601d6000396000f3fe6080604052600080fdfea164736f6c63430008120033";

export function App() {
  const [blockNumber, setBlockNumber] = useState(0);
  const [nodeStatus, setNodeStatus] = useState("Sincronizando...");
  const [backendStatus, setBackendStatus] = useState("Offline ❌");
  const [balance, setBalance] = useState("0.00");
  const [metaMaskAddress, setMetaMaskAddress] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState("");

  // ESTADOS DEL SISTEMA EXPERTO: EXPLORADOR Y FABRICA DE SMART CONTRACTS
  const [latestBlocks, setLatestBlocks] = useState([]);
  const [deployStatus, setDeployStatus] = useState("");

  useEffect(() => {
    const provider = new JsonRpcProvider(RPC_URL);
    const updateMetrics = async () => {
      try {
        const block = await provider.getBlockNumber();
        setBlockNumber(block);
        setNodeStatus("Online 🟢");

        const bal = await provider.getBalance(BILLETERA_TARGET);
        setBalance(Number(formatEther(bal)).toFixed(2));

        // Explorador dinámico: Consultar el historial de los últimos 3 bloques
        const blocksArray = [];
        for (let i = 0; i < 3; i++) {
          if (block - i >= 0) {
            const bInfo = await provider.getBlock(block - i);
            if (bInfo) {
              blocksArray.push({
                number: bInfo.number,
                hash: bInfo.hash.substring(0, 14) + "...",
                txs: bInfo.transactions.length
              });
            }
          }
        }
        setLatestBlocks(blocksArray);
      } catch (e) { 
        setNodeStatus("Offline 🔴"); 
      }

      try {
        const res = await fetch(`${BACKEND_URL}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "Online") {
            setBackendStatus("Online 🟢");
          } else {
            setBackendStatus("Offline ❌");
          }
        } else {
          setBackendStatus("Offline ❌");
        }
      } catch (e) {
        setBackendStatus("Offline ❌");
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1500);
    return () => clearInterval(interval);
  }, [blockNumber]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length > 0) setMetaMaskAddress(accounts[0]);
      } catch (err) {
        alert("Conexión rechazada en MetaMask");
      }
    } else {
      alert("Instala MetaMask en Chrome para habilitar inyección Web3");
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!window.ethereum || !metaMaskAddress) { alert("Vincula tu Gateway MetaMask"); return; }
    if (!recipient || !amount) { alert("Completa los datos"); return; }
    try {
      setTxStatus("Procesando pago...");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({ to: recipient, value: parseEther(amount) });
      setTxStatus(`Pendiente: ${tx.hash.substring(0, 10)}...`);
      await tx.wait();
      setTxStatus("¡Liquidación completada con éxito! 🚀");
      setRecipient(""); setAmount("");
    } catch (err) { setTxStatus("Error al procesar la transacción ❌"); }
  };

  const handleDeployContract = async (type) => {
    if (!window.ethereum || !metaMaskAddress) { alert("Vincula tu Gateway MetaMask primero."); return; }
    try {
      setDeployStatus(`Desplegando ${type}...`);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const factory = new ContractFactory(MIN_ABI, MIN_BYTECODE, signer);
      const contract = await factory.deploy();
      setDeployStatus(`Tx Hash: ${contract.deploymentTransaction().hash.substring(0, 12)}...`);
      
      await contract.waitForDeployment();
      setDeployStatus(`¡${type} Desplegado! Dirección: ${await contract.getAddress()}`);
    } catch (err) {
      setDeployStatus("Error en el despliegue ❌");
    }
  };
  const s = {
    wrapper: { minHeight: '100vh', background: 'linear-gradient(135deg, #070a13 0%, #0f172a 100%)', fontFamily: '"Segoe UI", Roboto, sans-serif', color: '#f1f5f9', padding: '60px 20px', boxSizing: 'border-box', position: 'relative', overflowX: 'hidden' },
    content: { maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 10 },
    header: { textAlign: 'center', marginBottom: '50px', background: 'rgba(30, 41, 59, 0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '25px 20px', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)' },
    subtitle: { fontSize: '12px', color: '#38bdf8', letterSpacing: '5px', textTransform: 'uppercase', margin: '0 0 8px 0', fontWeight: '700' },
    title: { fontSize: '38px', fontWeight: '800', color: '#ffffff', margin: '0 0 5px 0', letterSpacing: '-1px' },
    caption: { fontSize: '14px', color: '#94a3b8', letterSpacing: '1px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' },
    card: { background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '30px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' },
    cardTitle: { margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' },
    rowText: { margin: '14px 0', fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    labelKey: { color: '#64748b' },
    badgeRightActive: { fontWeight: 'bold', color: '#10b981', textShadow: '0 0 8px rgba(16, 185, 129, 0.6)' },
    blockBox: { marginTop: '25px', padding: '15px', background: 'rgba(0,0,0,0.4)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' },
    blockLabel: { fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' },
    blockValue: { fontSize: '34px', fontWeight: '900', color: '#38bdf8', fontFamily: 'monospace' },
    balanceBox: { fontSize: '52px', fontWeight: '900', color: '#10b981', fontFamily: 'monospace', letterSpacing: '-1px', margin: '15px 0' },
    balanceUnit: { fontSize: '22px', color: '#a7f3d0', fontWeight: '500' },
    addressFooter: { fontSize: '11px', color: '#64748b', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' },
    walletBtn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #f6851b, #e2761b)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(246,133,27,0.25)', marginBottom: '20px' },
    successBox: { padding: '15px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', marginBottom: '20px' },
    successTitle: { color: '#10b981', fontWeight: '700', fontSize: '13px', display: 'block', marginBottom: '5px' },
    successAddr: { fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8', wordBreak: 'break-all' },
    socialSection: { borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '15px', marginTop: '10px' },
    socialLabel: { fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px' },
    socialGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    btnGit: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#f1f5f9', textDecoration: 'none', fontSize: '13px', fontWeight: '600', boxShadow: '0 0 10px rgba(255, 255, 255, 0.05)', transition: 'box-shadow 0.3s ease' },
    btnLk: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', background: 'rgba(0, 82, 255, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', color: '#38bdf8', textDecoration: 'none', fontSize: '13px', fontWeight: '600', boxShadow: '0 0 12px rgba(56, 189, 248, 0.18)', transition: 'box-shadow 0.3s ease' },
    footer: { marginTop: '80px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '25px', fontSize: '12px', color: '#475569', letterSpacing: '1px' },
    particleContainer: { position: 'absolute', bottom: '0', left: '0', width: '100%', height: '140px', background: 'radial-gradient(circle at center bottom, rgba(16, 185, 129, 0.08) 0%, transparent 75%)', pointerEvents: 'none', zIndex: 1, borderTop: '1px dashed rgba(16, 185, 129, 0.04)', animation: 'pulseNet 6s ease-in-out infinite' },
    
    // COMPONENTES ESTÍLICOS ADICIONALES PARA LA NUEVA ERA FINTECH
    inputPay: { width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginBottom: '12px', boxSizing: 'border-box' },
    payBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)' },
    txStatusText: { fontSize: '11px', color: '#38bdf8', marginTop: '10px', display: 'block', textAlign: 'center', fontFamily: 'monospace' },
    deployGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' },
    btnDeploy: { padding: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', boxShadow: '0 0 10px rgba(59, 130, 246, 0.3)' }
  };
  return (
    <div style={s.wrapper}>
      <style>{`
        @keyframes pulseNet {
          0% { opacity: 0.6; transform: scaleY(1); }
          50% { opacity: 1; transform: scaleY(1.05); }
          100% { opacity: 0.6; transform: scaleY(1); }
        }
      `}</style>

      <div style={s.content}>
        <header style={s.header}>
          <span style={s.subtitle}>Blockchain Infrastructure Engineer</span>
          <h2 style={s.title}>Danny Andres Salazar</h2>
          <span style={s.caption}>Consola de Control de Producción • Private Ethereum Networks</span>
        </header>

        <div style={s.grid}>
          {/* TARJETA 1: RED Y CONSENSO */}
          <div style={s.card}>
            <div>
              <h3 style={s.cardTitle}>📊 Red & Consenso</h3>
              <div style={s.rowText}>
                <span style={s.labelKey}>Geth Engine Status:</span>
                <span style={s.badgeRightActive}>{nodeStatus}</span>
              </div>
              <div style={s.rowText}>
                <span style={s.labelKey}>API Orchestrator:</span>
                <span style={s.badgeRightActive}>{backendStatus}</span>
              </div>
            </div>
            <div style={s.blockBox}>
              <span style={s.blockLabel}>Altura del Ledger</span>
              <span style={s.blockValue}>#{blockNumber}</span>
            </div>
          </div>

          {/* TARJETA 2: CRÉDITOS EN CADENA */}
          <div style={s.card}>
            <div>
              <h3 style={s.cardTitle}>💰 Créditos en Cadena</h3>
              <span style={s.blockLabel}>Balance Ledger Destino</span>
              <div style={s.balanceBox}>{balance} <span style={s.balanceUnit}>ETH</span></div>
            </div>
            <div style={s.addressFooter}>Target: {BILLETERA_TARGET}</div>
          </div>

          {/* TARJETA 3: GATEWAY E INYECCIÓN */}
          <div style={s.card}>
            <div>
              <h3 style={s.cardTitle}>🦊 Gateway Inyectado</h3>
              {metaMaskAddress ? (
                <div style={s.successBox}>
                  <span style={s.successTitle}>Inyección Web3 Vinculada</span>
                  <span style={s.successAddr}>{metaMaskAddress.substring(0, 20)}...</span>
                </div>
              ) : (
                <button style={s.walletBtn} onClick={connectWallet}>Vincular Inyección Web3</button>
              )}
              
              {/* CORRECCIÓN EXPLICITA: Se mapeó a través del objeto 's' global */}
              <div style={s.socialSection}>
                <span style={s.socialLabel}>Perfiles del Desarrollador</span>
                <div style={s.socialGrid}>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={s.btnGit}>GitHub</a>
                  <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" style={s.btnLk}>LinkedIn</a>
                </div>
              </div>
            </div>
          </div>

          {/* TARJETA 4: PROCESADOR DE PAGOS */}
          <div style={s.card}>
            <div>
              <h3 style={s.cardTitle}>💳 Procesador de Pagos</h3>
              <form onSubmit={handlePayment}>
                <input type="text" placeholder="Dirección Destino (0x...)" value={recipient} onChange={(e) => setRecipient(e.target.value)} style={s.inputPay} />
                <input type="number" step="any" placeholder="Cantidad a Liquidar (ETH)" value={amount} onChange={(e) => setAmount(e.target.value)} style={s.inputPay} />
                <button type="submit" style={s.payBtn}>Ejecutar Liquidación Web3</button>
              </form>
              {txStatus && <span style={s.txStatusText}>{txStatus}</span>}
            </div>
          </div>

          {/* TARJETA 5: FÁBRICA DE SMART CONTRACTS */}
          <div style={s.card}>
            <div>
              <h3 style={s.cardTitle}>🚀 Fábrica de Contratos</h3>
              <span style={s.blockLabel}>Despliegue automatizado en un clic</span>
              <div style={s.deployGrid}>
                <button onClick={() => handleDeployContract("Token ERC-20")} style={s.btnDeploy}>Desplegar ERC-20</button>
                <button onClick={() => handleDeployContract("NFT ERC-721")} style={s.btnDeploy}>Desplegar ERC-721</button>
              </div>
              {deployStatus && <span style={s.txStatusText}>{deployStatus}</span>}
            </div>
          </div>

          {/* TARJETA 6: EXPLORADOR DE BLOQUES DINÁMICO */}
          <div style={s.card}>
            <div>
              <h3 style={s.cardTitle}>🔍 Explorador de Bloques</h3>
              <span style={s.blockLabel}>Historial de bloques minados</span>
              <div style={{ marginTop: '12px' }}>
                {latestBlocks.map((b) => (
                  <div key={b.number} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}>
                    <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>#{b.number}</span>
                    <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{b.hash}</span>
                    <span style={{ color: '#10b981' }}>{b.txs} txs</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        <footer style={s.footer}>
          Master Ingeniero en Blockchain • Entorno Gráfico Descentralizado • Práctica Operativa 2026
        </footer>
      </div>

      <div style={s.particleContainer}></div>
    </div>
  );
}
