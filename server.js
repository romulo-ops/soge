app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));


const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
app.use(express.urlencoded({ extended: true }));

// ====== DB ======
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Enquanto o login é provisório, usamos a empresa demo (id=1)
const DEMO_COMPANY_ID = 1;

// ====== Upload (xlsx) ======
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ====== Auth provisório ======
function isAuthed(req) {
  const cookie = req.headers.cookie || "";
  return cookie.includes("soge_auth=1");
}
function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.redirect("/login");
  next();
}

const views = (file) => path.join(__dirname, "views", file);

// ====== Rotas básicas ======
app.get("/", (req, res) => (isAuthed(req) ? res.redirect("/dashboard") : res.redirect("/login")));
app.get("/login", (req, res) => res.sendFile(views("login.html")));
app.post("/login", (req, res) => {
  res.setHeader("Set-Cookie", "soge_auth=1; Path=/; HttpOnly");
  res.redirect("/dashboard");
});
app.get("/logout", (req, res) => {
  res.setHeader("Set-Cookie", "soge_auth=; Path=/; Max-Age=0");
  res.redirect("/login");
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.send(`
  <!doctype html><html lang="pt-br"><head>
    <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>SOGE | Dashboard</title>
    <style>
      body{font-family:Arial,sans-serif; margin:0;}
      header{padding:14px 18px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;}
      nav a{margin-right:12px; text-decoration:none;}
      main{padding:18px;}
      .card{border:1px solid #e5e5e5; border-radius:12px; padding:16px; max-width:920px;}
    </style>
  </head><body>
    <header>
      <strong>SOGE</strong>
      <nav>
        <a href="/dashboard">Dashboard</a>
        <a href="/clientes">Clientes</a>
        <a href="/eventos">Eventos</a>
        <a href="/importar">Importar</a>
        <a href="/logout">Sair</a>
      </nav>
    </header>
    <main>
      <div class="card">
        <h1>Dashboard</h1>
        <p>Próximo passo: importar sua base (.xlsx) e transformar Clientes/Eventos em dados reais no SOGE.</p>
      </div>
    </main>
  </body></html>`);
});

// ====== Clientes (listagem simples) ======
app.get("/clientes", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, external_id, name, phone, email, created_at FROM clients WHERE company_id=? ORDER BY id DESC LIMIT 200",
    [DEMO_COMPANY_ID]
  );

  const items = rows
    .map(
      (c) => `<tr>
        <td>${c.id}</td>
        <td>${escapeHtml(c.external_id || "")}</td>
        <td>${escapeHtml(c.name || "")}</td>
        <td>${escapeHtml(c.phone || "")}</td>
        <td>${escapeHtml(c.email || "")}</td>
      </tr>`
    )
    .join("");

  res.send(`
  <!doctype html><html lang="pt-br"><head>
    <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>SOGE | Clientes</title>
    <style>
      body{font-family:Arial,sans-serif; padding:18px;}
      a{text-decoration:none;}
      table{border-collapse:collapse; width:100%; margin-top:16px;}
      th,td{border-bottom:1px solid #eee; padding:10px; text-align:left;}
      th{background:#fafafa;}
      .top a{margin-right:12px;}
    </style>
  </head><body>
    <div class="top">
      <strong>SOGE</strong> |
      <a href="/dashboard">Dashboard</a>
      <a href="/eventos">Eventos</a>
      <a href="/importar">Importar</a>
      <a href="/logout">Sair</a>
    </div>

    <h1>Clientes</h1>
    <p>Mostrando os últimos 200 clientes.</p>

    <table>
      <thead><tr><th>ID</th><th>External ID</th><th>Nome</th><th>Telefone</th><th>Email</th></tr></thead>
      <tbody>${items || `<tr><td colspan="5">Nenhum cliente encontrado.</td></tr>`}</tbody>
    </table>
  </body></html>`);
});

// ====== Eventos (placeholder por enquanto) ======
app.get("/eventos", requireAuth, (req, res) => res.sendFile(views("eventos.html")));

// ====== Tela de importação ======
app.get("/importar", requireAuth, (req, res) => {
  res.send(`
  <!doctype html><html lang="pt-br"><head>
    <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>SOGE | Importar</title>
    <style>
      body{font-family:Arial,sans-serif; padding:18px;}
      .card{border:1px solid #e5e5e5; border-radius:12px; padding:16px; max-width:820px;}
      input{margin-top:10px;}
      button{margin-top:12px; padding:10px 14px; border:0; border-radius:10px; cursor:pointer;}
      .top a{margin-right:12px; text-decoration:none;}
      .muted{color:#666; font-size:14px;}
    </style>
  </head><body>
    <div class="top">
      <strong>SOGE</strong> |
      <a href="/dashboard">Dashboard</a>
      <a href="/clientes">Clientes</a>
      <a href="/eventos">Eventos</a>
      <a href="/logout">Sair</a>
    </div>

    <h1>Importar base (.xlsx)</h1>
    <div class="card">
      <p class="muted">Importa na ordem correta: Clientes → Eventos → Propostas → Pagamentos, mantendo vínculos via IDs (external_id).</p>
      <form method="POST" action="/importar" enctype="multipart/form-data">
        <input type="file" name="file" accept=".xlsx" required />
        <br/>
        <button type="submit">Importar</button>
      </form>
    </div>
  </body></html>`);
});

// ====== Importação ======
app.post("/importar", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("Arquivo não recebido.");

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });

    // Ajuda: lista abas existentes
    const sheetNames = wb.SheetNames;

    // Função para ler aba em JSON (linhas)
    function readSheet(name) {
      const ws = wb.Sheets[name];
      if (!ws) return [];
      return XLSX.utils.sheet_to_json(ws, { defval: null });
    }

    // Ajuste: tente encontrar nomes de abas comuns
    // Se suas abas tiverem outros nomes, a gente adapta.
    const clientes = pickSheet(wb, ["Clientes", "clients", "CLIENTES"]);
    const eventos = pickSheet(wb, ["Eventos", "events", "EVENTOS"]);
    const propostas = pickSheet(wb, ["Propostas", "proposals", "PROPOSTAS"]);
    const pagamentos = pickSheet(wb, ["Pagamentos", "payments", "PAGAMENTOS"]);

    const rowsClientes = clientes ? readSheet(clientes) : [];
    const rowsEventos = eventos ? readSheet(eventos) : [];
    const rowsPropostas = propostas ? readSheet(propostas) : [];
    const rowsPagamentos = pagamentos ? readSheet(pagamentos) : [];

    // 1) CLIENTES (upsert por external_id)
    let importedClients = 0;
    for (const r of rowsClientes) {
      const externalId = asText(r.ClienteID ?? r.clienteid ?? r.id);
      const name = asText(r.Nome ?? r.nome ?? r.Cliente ?? r.cliente) || null;
      if (!externalId || !name) continue;

      const phone = asText(r.Telefone ?? r.telefone ?? r.Celular ?? r.celular) || null;
      const email = asText(r.Email ?? r.email) || null;
      const notes = asText(r.Observacoes ?? r.Observações ?? r.obs ?? r.OBS) || null;

      await pool.query(
        `INSERT INTO clients (company_id, external_id, name, phone, email, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name=VALUES(name),
           phone=VALUES(phone),
           email=VALUES(email),
           notes=VALUES(notes)`,
        [DEMO_COMPANY_ID, externalId, name, phone, email, notes]
      );
      importedClients++;
    }

    // Mapa external_id -> id para vínculos
    const [clientRows] = await pool.query(
      "SELECT id, external_id FROM clients WHERE company_id=? AND external_id IS NOT NULL",
      [DEMO_COMPANY_ID]
    );
    const clientMap = new Map(clientRows.map((c) => [String(c.external_id), c.id]));

    // 2) EVENTOS (precisa client_id)
    let importedEvents = 0;
    for (const r of rowsEventos) {
      const externalId = asText(r.EventoID ?? r.eventoid ?? r.id);
      const clienteExternal = asText(r.ClienteID ?? r.clienteid);
      if (!externalId || !clienteExternal) continue;

      const clientId = clientMap.get(String(clienteExternal));
      if (!clientId) continue; // evita órfão

      const eventDate = toDate(r.Data ?? r.data ?? r.EventDate ?? r.event_date);
      const startTime = toTime(r.HoraInicio ?? r.Inicio ?? r.start_time);
      const endTime = toTime(r.HoraFim ?? r.Fim ?? r.end_time);

      const eventType = asText(r.TipoEvento ?? r.tipo ?? r.Tipo) || null;
      const theme = asText(r.Tema ?? r.tema) || null;

      const kidsQty = toInt(r.QtdCriancas ?? r.Criancas ?? r.kids_qty);
      const avgAge = toInt(r.IdadeMedia ?? r.idade_media ?? r.avg_age);

      const neighborhood = asText(r.Bairro ?? r.bairro) || null;
      const address = asText(r.Endereco ?? r.endereco ?? r.Local ?? r.local) || null;
      const status = asText(r.Status ?? r.status) || null;
      const notes = asText(r.Observacoes ?? r.Observações ?? r.obs) || null;

      await pool.query(
        `INSERT INTO events
          (company_id, client_id, external_id, event_date, start_time, end_time, event_type, theme, kids_qty, avg_age, neighborhood, address, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          client_id=VALUES(client_id),
          event_date=VALUES(event_date),
          start_time=VALUES(start_time),
          end_time=VALUES(end_time),
          event_type=VALUES(event_type),
          theme=VALUES(theme),
          kids_qty=VALUES(kids_qty),
          avg_age=VALUES(avg_age),
          neighborhood=VALUES(neighborhood),
          address=VALUES(address),
          status=VALUES(status),
          notes=VALUES(notes)`,
        [DEMO_COMPANY_ID, clientId, externalId, eventDate, startTime, endTime, eventType, theme, kidsQty, avgAge, neighborhood, address, status, notes]
      );
      importedEvents++;
    }

    const [eventRows] = await pool.query(
      "SELECT id, external_id FROM events WHERE company_id=? AND external_id IS NOT NULL",
      [DEMO_COMPANY_ID]
    );
    const eventMap = new Map(eventRows.map((e) => [String(e.external_id), e.id]));

    // 3) PROPOSTAS (precisa event_id)
    let importedProposals = 0;
    for (const r of rowsPropostas) {
      const externalId = asText(r.PropostaID ?? r.propostaid ?? r.id);
      const eventoExternal = asText(r.EventoID ?? r.eventoid);
      if (!externalId || !eventoExternal) continue;

      const eventId = eventMap.get(String(eventoExternal));
      if (!eventId) continue;

      const proposalDate = toDate(r.DataProposta ?? r.data ?? r.proposal_date);
      const status = asText(r.Status ?? r.status) || null;

      const packageDescription = asText(r.Descricao ?? r.descricao ?? r.Pacote ?? r.pacote) || null;

      const service1 = asText(r.Servico1 ?? r.servico1) || null;
      const service2 = asText(r.Servico2 ?? r.servico2) || null;
      const service3 = asText(r.Servico3 ?? r.servico3) || null;
      const service4 = asText(r.Servico4 ?? r.servico4) || null;
      const service5 = asText(r.Servico5 ?? r.servico5) || null;

      const revenue = toMoney(r.Receita ?? r.valor ?? r.revenue);
      const suggestedPrice = toMoney(r.PrecoSugerido ?? r.suggested_price);
      const totalCost = toMoney(r.CustoTotal ?? r.total_cost);

      await pool.query(
        `INSERT INTO proposals
          (company_id, event_id, external_id, proposal_date, status, package_description, service_1, service_2, service_3, service_4, service_5, revenue, suggested_price, total_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          event_id=VALUES(event_id),
          proposal_date=VALUES(proposal_date),
          status=VALUES(status),
          package_description=VALUES(package_description),
          service_1=VALUES(service_1),
          service_2=VALUES(service_2),
          service_3=VALUES(service_3),
          service_4=VALUES(service_4),
          service_5=VALUES(service_5),
          revenue=VALUES(revenue),
          suggested_price=VALUES(suggested_price),
          total_cost=VALUES(total_cost)`,
        [DEMO_COMPANY_ID, eventId, externalId, proposalDate, status, packageDescription, service1, service2, service3, service4, service5, revenue, suggestedPrice, totalCost]
      );
      importedProposals++;
    }

    const [proposalRows] = await pool.query(
      "SELECT id, external_id FROM proposals WHERE company_id=? AND external_id IS NOT NULL",
      [DEMO_COMPANY_ID]
    );
    const proposalMap = new Map(proposalRows.map((p) => [String(p.external_id), p.id]));

    // 4) PAGAMENTOS (precisa proposal_id)
    let importedPayments = 0;
    for (const r of rowsPagamentos) {
      const externalId = asText(r.PagamentoID ?? r.pagamentoid ?? r.id);
      const propostaExternal = asText(r.PropostaID ?? r.propostaid);
      if (!externalId || !propostaExternal) continue;

      const proposalId = proposalMap.get(String(propostaExternal));
      if (!proposalId) continue;

      const method = asText(r.Forma ?? r.Metodo ?? r.method) || null;
      const dueDate = toDate(r.DataPrevista ?? r.vencimento ?? r.due_date);
      const expectedAmount = toMoney(r.ValorPrevisto ?? r.valor ?? r.expected_amount);
      const paidDate = toDate(r.DataPagamento ?? r.paid_date);
      const paidAmount = toMoney(r.ValorPago ?? r.paid_amount);
      const installments = toInt(r.Parcelas ?? r.installments);

      await pool.query(
        `INSERT INTO payments
          (company_id, proposal_id, external_id, method, due_date, expected_amount, paid_date, paid_amount, installments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          proposal_id=VALUES(proposal_id),
          method=VALUES(method),
          due_date=VALUES(due_date),
          expected_amount=VALUES(expected_amount),
          paid_date=VALUES(paid_date),
          paid_amount=VALUES(paid_amount),
          installments=VALUES(installments)`,
        [DEMO_COMPANY_ID, proposalId, externalId, method, dueDate, expectedAmount, paidDate, paidAmount, installments]
      );
      importedPayments++;
    }

    res.send(`
      <h1>Importação concluída</h1>
      <p>Abas detectadas: ${escapeHtml(sheetNames.join(", "))}</p>
      <ul>
        <li>Clientes processados: ${importedClients}</li>
        <li>Eventos processados: ${importedEvents}</li>
        <li>Propostas processadas: ${importedProposals}</li>
        <li>Pagamentos processados: ${importedPayments}</li>
      </ul>
      <p><a href="/clientes">Ver clientes</a> | <a href="/dashboard">Voltar ao dashboard</a></p>
    `);
  } catch (err) {
    res.status(500).send(`<pre>Erro na importação:\n${escapeHtml(err.stack || String(err))}</pre>`);
  }
});

// ====== Utilitários ======
function pickSheet(workbook, candidates) {
  const names = workbook.SheetNames;
  for (const c of candidates) {
    const found = names.find((n) => n.trim().toLowerCase() === c.toLowerCase());
    if (found) return found;
  }
  return null;
}

function asText(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toInt(v) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toMoney(v) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);

  // XLSX às vezes entrega número (serial excel)
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d && d.y && d.m && d.d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }

  // tenta formatos comuns
  const s = String(v).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return null;
}

function toTime(v) {
  if (!v) return null;
  const s = String(v).trim();
  // HH:MM
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.length === 4 ? `0${s}` : s;
  return null;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SOGE rodando na porta ${PORT}`));

