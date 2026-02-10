const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

/* ===============================
   CONFIGURAÇÕES
================================ */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

/* ===============================
   BANCO DE DADOS
================================ */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

const DEMO_COMPANY_ID = 1;

/* ===============================
   AUTENTICAÇÃO PROVISÓRIA
================================ */
function requireAuth(req, res, next) {
  next();
}

/* ===============================
   ROTAS
================================ */

app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

/* DASHBOARD */
app.get("/dashboard", requireAuth, async (req, res) => {
  const [[clients]] = await pool.query(
    "SELECT COUNT(*) AS total FROM clients WHERE company_id=?",
    [DEMO_COMPANY_ID]
  );
  const [[events]] = await pool.query(
    "SELECT COUNT(*) AS total FROM events WHERE company_id=?",
    [DEMO_COMPANY_ID]
  );
  const [[proposals]] = await pool.query(
    "SELECT COUNT(*) AS total FROM proposals WHERE company_id=?",
    [DEMO_COMPANY_ID]
  );
  const [[payments]] = await pool.query(
    "SELECT COUNT(*) AS total FROM payments WHERE company_id=?",
    [DEMO_COMPANY_ID]
  );

  res.render("layout", {
    title: "Dashboard",
    userLabel: "Empresa Demo",
    current: "dashboard",
    page: "dashboard",
    stats: {
      clientsCount: clients.total,
      eventsCount: events.total,
      proposalsCount: proposals.total,
      paymentsCount: payments.total,
    },
  });
});

/* CLIENTES */
app.get("/clientes", requireAuth, async (req, res) => {
  const [clients] = await pool.query(
    "SELECT id, external_id, name, phone, email FROM clients WHERE company_id=? ORDER BY id DESC LIMIT 200",
    [DEMO_COMPANY_ID]
  );

  res.render("layout", {
    title: "Clientes",
    userLabel: "Empresa Demo",
    current: "clientes",
    page: "clientes",
    clients,
  });
});

/* EVENTOS */
app.get("/eventos", requireAuth, async (req, res) => {
  const [events] = await pool.query(`
    SELECT 
      e.id,
      e.event_date,
      e.event_type,
      e.status,
      c.name AS client_name
    FROM events e
    LEFT JOIN clients c ON c.id = e.client_id
    WHERE e.company_id = ?
    ORDER BY e.event_date DESC
    LIMIT 200
  `, [DEMO_COMPANY_ID]);

  res.render("layout", {
    title: "Eventos",
    userLabel: "Empresa Demo",
    current: "eventos",
    page: "eventos",
    events,
  });
});

/* IMPORTAR */
app.get("/importar", requireAuth, (req, res) => {
  res.render("layout", {
    title: "Importar",
    userLabel: "Empresa Demo",
    current: "importar",
    page: "importar",
  });
});

/* ===============================
   SERVIDOR
================================ */
app.listen(PORT, () => {
  console.log("SOGE rodando na porta", PORT);
});
