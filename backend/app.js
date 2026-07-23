const express = require("express"); // https://expressjs.com/
const cors = require("cors"); // https://expressjs.com/en/resources/middleware/cors.html
const morgan = require("morgan"); // https://expressjs.com/en/resources/middleware/morgan.html
const app = express();

const networks = require("./router-network");
const node = require("./router-node");
const faucet = require("./router-faucet");

// Middlewares globales de seguridad y auditoría en producción
app.use(morgan('combined'));
app.use(cors()); // Desbloquea de forma estricta las restricciones de Google Chrome (CORS)

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORRECCIÓN DE ENRUTAMIENTO: Alineado con la API REST que consume tu Consola React
app.use("/api/orchestrator", networks);
app.use("/node", node);
app.use("/faucet", faucet);

// Ruta global para el manejo de endpoints no encontrados (404)
app.use("*", (req, res) => {
    res.status(404).send("NOT FOUND");
});

// CORRECCIÓN DE PUERTO: Forzado a 3333 para hacer match estricto con el puerto del frontend
const PORT = 3333;
app.listen(PORT, () => {
    console.log("escuchando ", PORT);
});
