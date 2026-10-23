const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Define a pasta que contém os arquivos públicos do jogo.
const publicPath = path.join(__dirname, "public");

app.use(express.static(publicPath));

// Se o endereço principal for acessado, entrega o jogo.
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Inicia o servidor.
app.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});

