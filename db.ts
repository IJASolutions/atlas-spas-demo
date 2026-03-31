import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res.rows;
}

export async function queryOne(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res.rows[0] || null;
}

export async function run(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}

export async function initDb() {
  // ─── Schema ───────────────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    msrp NUMERIC NOT NULL,
    floor_price NUMERIC NOT NULL,
    image_url TEXT,
    specs_json TEXT,
    sort_order INTEGER DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS product_options (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category_filter TEXT,
    sort_order INTEGER DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS discount_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    hot_tub_amount NUMERIC NOT NULL,
    swim_spa_amount NUMERIC NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS financing_plans (
    id SERIAL PRIMARY KEY,
    company TEXT NOT NULL,
    term_months INTEGER NOT NULL,
    rate NUMERIC NOT NULL,
    dealer_fee NUMERIC DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    event_date TEXT NOT NULL,
    location TEXT,
    booth TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    source TEXT DEFAULT 'walk-in',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run(`CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    event_id INTEGER REFERENCES events(id),
    appointment_time TEXT NOT NULL,
    product_interest TEXT,
    cascade_source TEXT,
    cascade_emails_opened INTEGER DEFAULT 0,
    cascade_texts_sent INTEGER DEFAULT 0,
    status TEXT DEFAULT 'scheduled',
    assigned_rep TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    event_id INTEGER REFERENCES events(id),
    source TEXT DEFAULT 'walk-in',
    product_interest TEXT,
    status TEXT DEFAULT 'new',
    assigned_rep TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run(`CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    product_id INTEGER REFERENCES products(id),
    lead_id INTEGER REFERENCES leads(id),
    options_json TEXT,
    discounts_json TEXT,
    financing_json TEXT,
    subtotal NUMERIC,
    options_total NUMERIC,
    discounts_total NUMERIC,
    tax_rate NUMERIC DEFAULT 0.0825,
    tax_amount NUMERIC,
    total NUMERIC,
    expo_discount BOOLEAN DEFAULT FALSE,
    tax_exempt BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run(`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER REFERENCES quotes(id),
    lead_id INTEGER REFERENCES leads(id),
    customer_id INTEGER REFERENCES customers(id),
    contract_number TEXT,
    total NUMERIC,
    total_paid NUMERIC DEFAULT 0,
    balance NUMERIC,
    model_type TEXT,
    serial_number TEXT,
    location TEXT,
    financing_company TEXT,
    financing_amount NUMERIC DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run(`CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    payment_type TEXT NOT NULL,
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

export async function seedDb() {
  const count = await queryOne("SELECT COUNT(*) as c FROM products");
  if (count && parseInt(count.c) > 0) {
    console.log("Database already seeded.");
    return;
  }

  // ─── Locations ────────────────────────────────────────────
  const locations = ['Dallas Main', 'Houston', 'San Antonio', 'Austin', 'Corpus Christi', 'Fort Worth', 'Midland', 'Odessa', 'Amarillo'];
  for (const loc of locations) {
    await run("INSERT INTO locations (name) VALUES ($1) ON CONFLICT DO NOTHING", [loc]);
  }

  // ─── Products ─────────────────────────────────────────────
  const IMG_HT = "https://lh3.googleusercontent.com/aida-public/AB6AXuCDPCV7CyjyYBxJln2S9kU5NU8zNpu_MVcQpF8neK2Jjoc0JXzRicTfqG9s_Imvo44HVSufjb57J-kv2r4foMkEP0ZcM-7QanxIAL8dUUqR7PYSUYtsx1IVZWb_Nybo2qSHrSVjttwrSDZP8fRRSZXabrR17bZ5QXTMFs8fkE1KaujCZMu0piRbre3bE4fk8hZHs09raRhqwmtuLaCuctxahPMpQwkXS87Z-ajQP0Gp3xq1PMm5hHxLbE-FpmiwoNthYW5oPny8hCQe";
  const IMG_SS = "https://lh3.googleusercontent.com/aida-public/AB6AXuAPHqQCYqCKorqSoC5i5IVvMeUzGobfb2OAeiqwDrroBm2318h4EhLGHcOhQd3GHHXM9W8YhjaeVNwNpC0bKOUMrbxeYZcZ6lt-FNbV542ValaJ6cwR-nscR_E8TlPnMmElAVTggZ2Pur9651wTliFnYfFHMDTnQyp7ub-e4RD00NY6Kl0yj17-CosAymTLlaEpe-R-LKfF87UAn-Kq91Q1PvFAYfB36qo9up-UK-r26wS-NxkxCseVIbUYl5ykxg6e0uLFTUV7tcff";
  const IMG_CP = "https://lh3.googleusercontent.com/aida-public/AB6AXuB4ySEZ67G3z1GYKZi8i9Mj3DxVtquGkOCaRdx2KEVLNXd_gnKz9Sm4s0WtX6Xg78WyvP5ecfMzTZzTEAJTws00EZRjxEovmJIvKzrfRdPhFGTC2WX3uoMtu-T8BBzuXyusa1VMQMtGbjngvR133ufdevKfPeA4JWwFgYnuIgKrV0U4KgIMT1EYkv6HMxuf_IT8juy_WYyJHF7O2i8eCGIRh_DqSIF5B7Am_znsfltUdc1KnTDKmqYY1cz0vSlz51d90QAjWoY2M7Wx";

  const products = [
    ["Twilight Series 8.25", "hot_tub", 14995, 12995, IMG_HT, JSON.stringify({seats:6,dimensions:"7ft 6in x 7ft 6in",jets:50,weight:"850 lbs"}), 1],
    ["Signature L-800 Spa", "hot_tub", 11495, 9495, IMG_HT, JSON.stringify({seats:5,dimensions:"7ft x 7ft",jets:42,weight:"780 lbs"}), 2],
    ["Clarity Spas Balance 8", "hot_tub", 8995, 7495, IMG_HT, JSON.stringify({seats:4,dimensions:"6ft 8in x 6ft 8in",jets:32,weight:"650 lbs"}), 3],
    ["Getaway SE Hot Tub", "hot_tub", 6995, 5495, null, JSON.stringify({seats:4,dimensions:"6ft x 6ft",jets:24,weight:"550 lbs"}), 4],
    ["Michael Phelps Signature Swim Spa", "swim_spa", 34995, 29995, IMG_SS, JSON.stringify({length:"18ft x 8ft",seats:4,swim_jets:8,therapy_jets:38}), 5],
    ["Challenger 15 D Swim Spa", "swim_spa", 27995, 23995, IMG_HT, JSON.stringify({length:"15ft x 7ft 8in",seats:3,swim_jets:6,therapy_jets:28}), 6],
    ["H2X Trainer 17 D", "swim_spa", 31995, 26995, null, JSON.stringify({length:"17ft x 8ft",seats:4,swim_jets:8,therapy_jets:32}), 7],
    ["Alpine Cold Plunge", "cold_plunge", 6995, 5995, IMG_CP, JSON.stringify({temp:"40F min",dimensions:"5ft 6in x 3ft 4in",recovery:"Full body immersion"}), 8],
    ["Chilly GOAT Cold Tub", "cold_plunge", 7995, 6995, null, JSON.stringify({temp:"37F min",dimensions:"6ft x 3ft 6in",recovery:"Dual zone cooling"}), 9],
  ];
  for (const p of products) {
    await run("INSERT INTO products (name, category, msrp, floor_price, image_url, specs_json, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)", p);
  }

  // ─── Options ──────────────────────────────────────────────
  const options = [
    ["Jets Package", 595, null, 1], ["LED Lights Package", 395, null, 2],
    ["Smart Top Cover w/ Handrail", 1295, null, 3], ["Chemical Kit", 149, null, 4],
    ["Lifter", 349, "hot_tub", 5], ["Commercial Warranty", 495, null, 6],
    ["Doc Fee", 295, null, 7], ["Cover Lifter Cradle", 249, "swim_spa", 8],
    ["Steps with Handrail", 399, null, 9],
  ];
  for (const o of options) await run("INSERT INTO product_options (name, price, category_filter, sort_order) VALUES ($1,$2,$3,$4)", o);

  // ─── Discounts ────────────────────────────────────────────
  const discounts = [
    ["Factory Rebate", 500, 1000], ["Paid in Full", 250, 500], ["Floor Model", 250, 500],
    ["Immediate Delivery", 250, 250], ["Military / First Responder", 250, 250],
  ];
  for (const d of discounts) await run("INSERT INTO discount_types (name, hot_tub_amount, swim_spa_amount) VALUES ($1,$2,$3)", d);

  // ─── Financing ────────────────────────────────────────────
  const plans = [
    ["GreenSky", 60, 6.99, 12], ["GreenSky", 120, 9.99, 15],
    ["Wells Fargo", 48, 5.99, 10], ["Foundation", 60, 7.99, 14], ["In House", 36, 0, 0],
  ];
  for (const p of plans) await run("INSERT INTO financing_plans (company, term_months, rate, dealer_fee) VALUES ($1,$2,$3,$4)", p);

  // ─── Event ────────────────────────────────────────────────
  await run("INSERT INTO events (name, event_date, location, booth) VALUES ($1,$2,$3,$4)",
    ["Dallas Home & Garden Show", "2026-03-31", "Dallas Convention Center", "Booth #402 - Aisle 4, Near Main Entrance"]);

  // ─── Customers ────────────────────────────────────────────
  const customers = [
    ["Marcus", "Thorne", "(214) 555-0147", "marcus.thorne@email.com", "4821 Oak Lawn Ave, Dallas TX 75219", "cascade"],
    ["Sarah", "Jenkins", "(214) 555-0293", "sarah.jenkins@email.com", "1200 Ross Ave, Dallas TX 75202", "cascade"],
    ["Robert", "Chen", "(972) 555-0384", "robert.chen@email.com", "3500 Maple Ave, Dallas TX 75219", "referral"],
    ["Maria", "Lopez", "(469) 555-0158", "maria.lopez@email.com", "2100 McKinney Ave, Dallas TX 75201", "cascade"],
    ["David", "Kim", "(214) 555-0726", "david.kim@email.com", "5600 Greenville Ave, Dallas TX 75206", "walk-in"],
    ["Jennifer", "Williams", "(817) 555-0419", "jennifer.williams@email.com", "800 Main St, Fort Worth TX 76102", "cascade"],
    ["Michael", "Rodriguez", "(210) 555-0553", "michael.rodriguez@email.com", "300 Alamo Plaza, San Antonio TX 78205", "cascade"],
    ["Emily", "Davis", "(512) 555-0687", "emily.davis@email.com", "1100 Congress Ave, Austin TX 78701", "walk-in"],
    ["James", "Wilson", "(214) 555-0891", "james.wilson@email.com", "900 Jackson St, Dallas TX 75202", "cascade"],
    ["Ashley", "Martinez", "(469) 555-0234", "ashley.martinez@email.com", "700 Flora St, Dallas TX 75201", "referral"],
    ["Brandon", "Taylor", "(972) 555-0567", "brandon.taylor@email.com", "2800 Routh St, Dallas TX 75201", "cascade"],
    ["Lisa", "Anderson", "(214) 555-0345", "lisa.anderson@email.com", "4200 Cedar Springs Rd, Dallas TX 75219", "walk-in"],
  ];
  for (const c of customers) await run("INSERT INTO customers (first_name, last_name, phone, email, address, source) VALUES ($1,$2,$3,$4,$5,$6)", c);

  // ─── Appointments ─────────────────────────────────────────
  const appts = [
    [1, 1, "10:30", "Atlas X-Series 17'", "Cascade High-Intent", 3, 1, "scheduled", "Brock"],
    [2, 1, "11:15", "Signature L-800 Spa", "Retargeting Flow", 2, 0, "scheduled", "Brock"],
    [3, 1, "13:00", "Titan Swim-Gym Duo", "Showroom Referral", 0, 0, "scheduled", "Alex"],
    [4, 1, "10:00", "Twilight 7.25 Swim Spa", "Spring Expo Email Blast", 3, 1, "checked_in", "Brock"],
    [6, 1, "11:45", "Michael Phelps Signature", "Email Campaign Q1", 4, 2, "scheduled", "Alex"],
    [7, 1, "14:00", "Challenger 15 D", "Cascade Re-engagement", 1, 1, "scheduled", "Brock"],
    [9, 1, "14:30", "Alpine Cold Plunge", "Cold Therapy Campaign", 2, 0, "scheduled", "Alex"],
    [11, 1, "15:00", "Twilight Series 8.25", "Spring Expo Email Blast", 5, 3, "scheduled", "Brock"],
  ];
  for (const a of appts) await run("INSERT INTO appointments (customer_id, event_id, appointment_time, product_interest, cascade_source, cascade_emails_opened, cascade_texts_sent, status, assigned_rep) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", a);

  // ─── Leads ────────────────────────────────────────────────
  const leadData = [
    [4, 1, "cascade", "Twilight 7.25 Swim Spa", "closed_won", "Brock", "Very interested. Backyard measured. Wants financing options."],
    [5, 1, "walk-in", "Signature L-800 Spa", "new", "Brock", "Walked in, browsing. Seemed price-sensitive."],
    [8, 1, "walk-in", "Alpine Cold Plunge", "new", "Alex", "Asked about recovery benefits. Crossfit athlete."],
    [10, 1, "referral", "Michael Phelps Signature", "negotiating", "Alex", "Referred by Robert Chen. Wants MP Signature. Discussing financing."],
    [1, 1, "cascade", "Atlas X-Series 17'", "appointment_set", "Brock", null],
    [2, 1, "cascade", "Signature L-800 Spa", "appointment_set", "Brock", null],
    [12, 1, "walk-in", "Clarity Spas Balance 8", "follow_up", "Brock", "Needs to discuss with spouse. Call back Thursday."],
    [6, 1, "cascade", "Michael Phelps Signature", "showed", "Alex", "Checked in. Looking at swim spas for home gym replacement."],
  ];
  for (const l of leadData) await run("INSERT INTO leads (customer_id, event_id, source, product_interest, status, assigned_rep, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)", l);

  // ─── Existing quote + order with payment history ──────────
  await run(`INSERT INTO quotes (customer_id, product_id, lead_id, options_json, discounts_json, subtotal, options_total, discounts_total, tax_rate, tax_amount, total, expo_discount, status)
    VALUES (4, 7, 1, '["Jets Package","LED Lights Package","Smart Top Cover w/ Handrail"]', '["Factory Rebate"]', 26995, 2285, 1000, 0.0825, 2330.13, 30610.13, true, 'accepted')`);

  await run(`INSERT INTO orders (quote_id, lead_id, customer_id, contract_number, total, total_paid, balance, model_type, location, status)
    VALUES (1, 1, 4, 'AS-2026-0831', 30610.13, 15305.07, 15305.06, 'Factory Build', 'Dallas Main', 'partially_paid')`);

  // Payment history: deposit + one installment
  await run(`INSERT INTO payments (order_id, amount, payment_method, payment_type, reference, notes) VALUES
    (1, 9183.04, 'credit_card', 'deposit', 'TXN-20260315-001', 'Initial deposit at expo')`);
  await run(`INSERT INTO payments (order_id, amount, payment_method, payment_type, reference, notes) VALUES
    (1, 6122.03, 'ach', 'installment', 'TXN-20260322-002', 'Second installment payment')`);

  console.log("Database seeded with demo data.");
}
