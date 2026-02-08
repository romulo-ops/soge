const express = require("express");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: true }));

// Login provisório via cookie simples (apenas para validar fluxo)
function isAuthed(req) {
  const cookie = req.headers.cookie || "";
  return cookie.includes("soge_auth=1");
}

function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.redirect("/login");
  next();
}

const views = (file) => path.join(__dirname, "views", file);

app.get("/", (req, res) => {
  if (isAuthed(req)) return res.redirect("/dashboard");
  res.redirect("/login");
});

app.get("/login", (req, res) => res.sendFile(views("login.html")));

app.post("/login", (req, res) => {
  // Provisório: aceita qualquer email/senha
  res.setHeader("Set-Cookie", "soge_auth=1; Path=/; HttpOnly");
  res.redirect("/dashboard");
});

app.get("/logout", (req, res) => {
  res.setHeader("Set-Cookie", "soge_auth=; Path=/; Max-Age=0");
  res.redirect("/login");
});

app.get("/dashboard", requireAuth, (req, res) =>
  res.sendFile(views("dashboard.html"))
);

app.get("/clientes", requireAuth, (req, res) =>
  res.sendFile(views("clientes.html"))
);

app.get("/eventos", requireAuth, (req, res) =>
  res.sendFile(views("eventos.html"))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SOGE rodando na porta ${PORT}`));
