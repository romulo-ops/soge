const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("SOGE está online 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SOGE rodando na porta ${PORT}`);
});
