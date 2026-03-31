import { initDb, seedDb, query, queryOne, run } from "./db";
import { join } from "path";
import { existsSync } from "fs";

// ─── Initialize Database ────────────────────────────────────
await initDb();
await seedDb();

const PORT = parseInt(process.env.PORT || "8080");
const STATIC_DIR = import.meta.dir;

// ─── Helpers ────────────────────────────────────────────────
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ─── API Routes ─────────────────────────────────────────────
async function handleApi(url: URL, req: Request): Promise<Response | null> {
  const path = url.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
    });
  }

  // ── Products ──────────────────────────────────────────────
  if (path === "/api/products" && method === "GET") {
    return json(await query("SELECT * FROM products ORDER BY sort_order"));
  }

  const productMatch = path.match(/^\/api\/products\/(\d+)$/);
  if (productMatch && method === "GET") {
    const id = parseInt(productMatch[1]);
    const product = await queryOne("SELECT * FROM products WHERE id = $1", [id]);
    if (!product) return json({ error: "Product not found" }, 404);
    const options = await query(
      "SELECT * FROM product_options WHERE category_filter IS NULL OR category_filter = $1 ORDER BY sort_order", [product.category]
    );
    return json({ ...product, options });
  }

  // ── Options ───────────────────────────────────────────────
  if (path === "/api/options" && method === "GET") {
    const category = url.searchParams.get("category");
    if (category) {
      return json(await query("SELECT * FROM product_options WHERE category_filter IS NULL OR category_filter = $1 ORDER BY sort_order", [category]));
    }
    return json(await query("SELECT * FROM product_options ORDER BY sort_order"));
  }

  // ── Discounts ─────────────────────────────────────────────
  if (path === "/api/discounts" && method === "GET") {
    return json(await query("SELECT * FROM discount_types"));
  }

  // ── Financing ─────────────────────────────────────────────
  if (path === "/api/financing" && method === "GET") {
    return json(await query("SELECT * FROM financing_plans"));
  }

  // ── Locations ─────────────────────────────────────────────
  if (path === "/api/locations" && method === "GET") {
    return json(await query("SELECT * FROM locations ORDER BY name"));
  }

  // ── Events ────────────────────────────────────────────────
  if (path === "/api/events" && method === "GET") {
    return json(await query("SELECT * FROM events"));
  }
  const eventMatch = path.match(/^\/api\/events\/(\d+)$/);
  if (eventMatch && method === "GET") {
    const ev = await queryOne("SELECT * FROM events WHERE id = $1", [parseInt(eventMatch[1])]);
    return ev ? json(ev) : json({ error: "Not found" }, 404);
  }

  // ── Customers ─────────────────────────────────────────────
  if (path === "/api/customers" && method === "GET") {
    return json(await query("SELECT * FROM customers ORDER BY last_name"));
  }
  if (path === "/api/customers" && method === "POST") {
    const body = await req.json();
    const row = await queryOne(
      "INSERT INTO customers (first_name, last_name, phone, email, address, source) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [body.first_name, body.last_name, body.phone || null, body.email || null, body.address || null, body.source || "walk-in"]
    );
    return json(row, 201);
  }

  // ── Appointments ──────────────────────────────────────────
  if (path === "/api/appointments" && method === "GET") {
    const eventId = url.searchParams.get("event_id") || "1";
    return json(await query(`
      SELECT a.*, c.first_name, c.last_name, c.phone, c.email
      FROM appointments a JOIN customers c ON a.customer_id = c.id
      WHERE a.event_id = $1 ORDER BY a.appointment_time
    `, [parseInt(eventId)]));
  }
  const apptMatch = path.match(/^\/api\/appointments\/(\d+)$/);
  if (apptMatch && method === "PATCH") {
    const body = await req.json();
    if (body.status) await run("UPDATE appointments SET status = $1 WHERE id = $2", [body.status, parseInt(apptMatch[1])]);
    return json(await queryOne("SELECT a.*, c.first_name, c.last_name, c.phone, c.email FROM appointments a JOIN customers c ON a.customer_id = c.id WHERE a.id = $1", [parseInt(apptMatch[1])]));
  }

  // ── Leads ─────────────────────────────────────────────────
  if (path === "/api/leads" && method === "GET") {
    const status = url.searchParams.get("status");
    if (status) {
      return json(await query("SELECT l.*, c.first_name, c.last_name, c.phone, c.email FROM leads l JOIN customers c ON l.customer_id = c.id WHERE l.status = $1 ORDER BY l.updated_at DESC", [status]));
    }
    return json(await query("SELECT l.*, c.first_name, c.last_name, c.phone, c.email FROM leads l JOIN customers c ON l.customer_id = c.id ORDER BY l.updated_at DESC"));
  }
  if (path === "/api/leads" && method === "POST") {
    const body = await req.json();
    const row = await queryOne(
      "INSERT INTO leads (customer_id, event_id, source, product_interest, status, assigned_rep, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [body.customer_id, body.event_id || 1, body.source || "walk-in", body.product_interest || null, body.status || "new", body.assigned_rep || "Brock", body.notes || null]
    );
    return json(row, 201);
  }
  const leadMatch = path.match(/^\/api\/leads\/(\d+)$/);
  if (leadMatch && method === "PATCH") {
    const id = parseInt(leadMatch[1]);
    const body = await req.json();
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    if (body.status) { sets.push(`status = $${idx++}`); vals.push(body.status); }
    if (body.notes) { sets.push(`notes = $${idx++}`); vals.push(body.notes); }
    if (body.assigned_rep) { sets.push(`assigned_rep = $${idx++}`); vals.push(body.assigned_rep); }
    sets.push("updated_at = NOW()");
    vals.push(id);
    await run(`UPDATE leads SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
    return json(await queryOne("SELECT l.*, c.first_name, c.last_name FROM leads l JOIN customers c ON l.customer_id = c.id WHERE l.id = $1", [id]));
  }

  // ── Quotes ────────────────────────────────────────────────
  if (path === "/api/quotes" && method === "GET") {
    return json(await query("SELECT * FROM quotes ORDER BY created_at DESC"));
  }
  if (path === "/api/quotes" && method === "POST") {
    const body = await req.json();
    const row = await queryOne(`
      INSERT INTO quotes (customer_id, product_id, lead_id, options_json, discounts_json, financing_json,
        subtotal, options_total, discounts_total, tax_rate, tax_amount, total, expo_discount, tax_exempt, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [body.customer_id||null, body.product_id||null, body.lead_id||null,
       JSON.stringify(body.options||[]), JSON.stringify(body.discounts||[]), JSON.stringify(body.financing||null),
       body.subtotal, body.options_total, body.discounts_total,
       body.tax_rate||0.0825, body.tax_amount, body.total,
       body.expo_discount||false, body.tax_exempt||false, "draft"]
    );
    return json(row, 201);
  }

  // ── Orders ────────────────────────────────────────────────
  if (path === "/api/orders" && method === "GET") {
    return json(await query(`
      SELECT o.*, c.first_name, c.last_name, c.phone, c.email,
             q.total as quote_total, p.name as product_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN quotes q ON o.quote_id = q.id
      LEFT JOIN products p ON q.product_id = p.id
      ORDER BY o.created_at DESC
    `));
  }
  if (path === "/api/orders" && method === "POST") {
    const body = await req.json();
    const contractNum = "AS-2026-" + String(Math.floor(Math.random() * 9000) + 1000);
    const total = body.total || body.deposit + body.balance;
    const order = await queryOne(`
      INSERT INTO orders (quote_id, lead_id, customer_id, contract_number, total, total_paid, balance,
        model_type, serial_number, location, financing_company, financing_amount, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [body.quote_id||null, body.lead_id||null, body.customer_id||null,
       contractNum, total, body.deposit||0, (total - (body.deposit||0)),
       body.model_type||"In-Stock", body.serial_number||null,
       body.location||"Dallas Main", body.financing_company||null, body.financing_amount||0,
       body.notes||null, body.deposit > 0 ? "deposit_received" : "pending"]
    );
    // Record the deposit as first payment
    if (body.deposit > 0) {
      await run(
        "INSERT INTO payments (order_id, amount, payment_method, payment_type, reference, notes) VALUES ($1,$2,$3,$4,$5,$6)",
        [order.id, body.deposit, body.payment_method||"credit_card", "deposit", `TXN-${Date.now()}`, "Initial deposit"]
      );
    }
    if (body.lead_id) {
      await run("UPDATE leads SET status = 'closed_won', updated_at = NOW() WHERE id = $1", [body.lead_id]);
    }
    return json(order, 201);
  }

  const orderMatch = path.match(/^\/api\/orders\/(\d+)$/);
  if (orderMatch && method === "GET") {
    const id = parseInt(orderMatch[1]);
    const order = await queryOne(`
      SELECT o.*, c.first_name, c.last_name, c.phone, c.email, p.name as product_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN quotes q ON o.quote_id = q.id
      LEFT JOIN products p ON q.product_id = p.id
      WHERE o.id = $1
    `, [id]);
    if (!order) return json({ error: "Not found" }, 404);
    const payments = await query("SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at", [id]);
    return json({ ...order, payments });
  }

  // ── Payments ──────────────────────────────────────────────
  const paymentsMatch = path.match(/^\/api\/orders\/(\d+)\/payments$/);
  if (paymentsMatch && method === "GET") {
    const orderId = parseInt(paymentsMatch[1]);
    return json(await query("SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at", [orderId]));
  }
  if (paymentsMatch && method === "POST") {
    const orderId = parseInt(paymentsMatch[1]);
    const body = await req.json();
    const order = await queryOne("SELECT * FROM orders WHERE id = $1", [orderId]);
    if (!order) return json({ error: "Order not found" }, 404);

    const payment = await queryOne(
      "INSERT INTO payments (order_id, amount, payment_method, payment_type, reference, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [orderId, body.amount, body.payment_method, body.payment_type || "installment", body.reference || `TXN-${Date.now()}`, body.notes || null]
    );

    // Update order totals
    const newTotalPaid = parseFloat(order.total_paid) + body.amount;
    const newBalance = parseFloat(order.total) - newTotalPaid;
    let newStatus = order.status;
    if (newBalance <= 0) newStatus = "paid_in_full";
    else if (newTotalPaid > 0) newStatus = "partially_paid";

    await run("UPDATE orders SET total_paid = $1, balance = $2, status = $3 WHERE id = $4",
      [newTotalPaid, Math.max(0, newBalance), newStatus, orderId]);

    const updated = await queryOne("SELECT * FROM orders WHERE id = $1", [orderId]);
    return json({ payment, order: updated }, 201);
  }

  // ── Dashboard Stats ───────────────────────────────────────
  if (path === "/api/dashboard" && method === "GET") {
    const eventId = url.searchParams.get("event_id") || "1";
    const eid = parseInt(eventId);
    const event = await queryOne("SELECT * FROM events WHERE id = $1", [eid]);
    const totalAppts = (await queryOne("SELECT COUNT(*) as c FROM appointments WHERE event_id = $1", [eid])).c;
    const checkedIn = (await queryOne("SELECT COUNT(*) as c FROM appointments WHERE event_id = $1 AND status = 'checked_in'", [eid])).c;
    const walkIns = (await queryOne("SELECT COUNT(*) as c FROM leads WHERE event_id = $1 AND source = 'walk-in'", [eid])).c;
    const quotesCount = (await queryOne("SELECT COUNT(*) as c FROM quotes WHERE customer_id IN (SELECT customer_id FROM leads WHERE event_id = $1)", [eid])).c;
    const revenue = await queryOne(`
      SELECT COALESCE(SUM(o.total_paid), 0) as total_deposits,
             COALESCE(SUM(o.total), 0) as total_revenue
      FROM orders o WHERE o.customer_id IN (SELECT customer_id FROM leads WHERE event_id = $1)
    `, [eid]);
    return json({ event, stats: { appointments: parseInt(totalAppts), checked_in: parseInt(checkedIn), walk_ins: parseInt(walkIns), quotes: parseInt(quotesCount), revenue: parseFloat(revenue.total_revenue), deposits: parseFloat(revenue.total_deposits) }});
  }

  return null;
}

// ─── Server ─────────────────────────────────────────────────
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      const apiResponse = await handleApi(url, req);
      if (apiResponse) return apiResponse;
      return json({ error: "Not found" }, 404);
    }
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    filePath = filePath.slice(1);
    const fullPath = join(STATIC_DIR, filePath);
    if (existsSync(fullPath)) return new Response(Bun.file(fullPath));
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`
╔══════════════════════════════════════════════════════╗
║  Atlas Spas Demo Server                              ║
║  http://localhost:${PORT}                               ║
║  Database: ${process.env.DATABASE_URL ? "PostgreSQL (Railway)" : "No DATABASE_URL set"}
╚══════════════════════════════════════════════════════╝
`);
