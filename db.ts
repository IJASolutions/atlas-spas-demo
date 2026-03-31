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
    // ── Twilight Series (Premium Hot Tubs) ──────────────────
    ["Twilight Series TS 8.25", "hot_tub", 16995, 14495, IMG_HT, JSON.stringify({series:"Twilight",seats:6,dimensions:"91 x 91 x 38 in",jets:57,weight:"875 lbs",gallons:425,electrical:"240V/50A"}), 1],
    ["Twilight Series TS 8.2", "hot_tub", 15495, 12995, IMG_HT, JSON.stringify({series:"Twilight",seats:6,dimensions:"91 x 91 x 38 in",jets:48,weight:"840 lbs",gallons:400,electrical:"240V/50A"}), 2],
    ["Twilight Series TS 7.25", "hot_tub", 13995, 11495, IMG_HT, JSON.stringify({series:"Twilight",seats:5,dimensions:"84 x 84 x 36 in",jets:45,weight:"750 lbs",gallons:350,electrical:"240V/40A"}), 3],
    ["Twilight Series TS 7.2", "hot_tub", 12495, 10495, IMG_HT, JSON.stringify({series:"Twilight",seats:5,dimensions:"84 x 84 x 36 in",jets:38,weight:"720 lbs",gallons:325,electrical:"240V/40A"}), 4],
    ["Twilight Series TS 6.2", "hot_tub", 10995, 8995, IMG_HT, JSON.stringify({series:"Twilight",seats:4,dimensions:"78 x 78 x 34 in",jets:30,weight:"650 lbs",gallons:275,electrical:"240V/40A"}), 5],
    ["Twilight Series TS 240X", "hot_tub", 14495, 11995, IMG_HT, JSON.stringify({series:"Twilight",seats:5,dimensions:"84 x 84 x 36 in",jets:40,weight:"760 lbs",gallons:340,electrical:"240V/50A"}), 6],

    // ── Michael Phelps Legend Series (Premium Hot Tubs) ──────
    ["Legend LSX 900", "hot_tub", 18995, 15995, IMG_HT, JSON.stringify({series:"Legend",seats:7,dimensions:"94 x 94 x 40 in",jets:65,weight:"950 lbs",gallons:475,electrical:"240V/50A"}), 7],
    ["Legend LSX 850", "hot_tub", 17495, 14495, IMG_HT, JSON.stringify({series:"Legend",seats:6,dimensions:"91 x 91 x 38 in",jets:55,weight:"890 lbs",gallons:435,electrical:"240V/50A"}), 8],
    ["Legend LSX 800", "hot_tub", 15995, 13495, IMG_HT, JSON.stringify({series:"Legend",seats:6,dimensions:"91 x 91 x 38 in",jets:48,weight:"850 lbs",gallons:410,electrical:"240V/50A"}), 9],
    ["Legend LSX 700", "hot_tub", 14495, 11995, IMG_HT, JSON.stringify({series:"Legend",seats:5,dimensions:"84 x 84 x 36 in",jets:42,weight:"750 lbs",gallons:350,electrical:"240V/40A"}), 10],

    // ── Clarity Spas (Mid-Range Hot Tubs) ────────────────────
    ["Clarity Spas Balance 9", "hot_tub", 10995, 8995, IMG_HT, JSON.stringify({series:"Clarity",seats:6,dimensions:"91 x 91 x 36 in",jets:35,weight:"780 lbs",gallons:375,electrical:"240V/40A"}), 11],
    ["Clarity Spas Balance 8", "hot_tub", 9495, 7495, IMG_HT, JSON.stringify({series:"Clarity",seats:5,dimensions:"84 x 84 x 34 in",jets:30,weight:"680 lbs",gallons:310,electrical:"240V/40A"}), 12],
    ["Clarity Spas Balance 7", "hot_tub", 7995, 6495, IMG_HT, JSON.stringify({series:"Clarity",seats:4,dimensions:"78 x 78 x 33 in",jets:25,weight:"600 lbs",gallons:260,electrical:"240V/30A"}), 13],
    ["Clarity Spas Balance 6", "hot_tub", 6995, 5495, IMG_HT, JSON.stringify({series:"Clarity",seats:3,dimensions:"72 x 72 x 32 in",jets:20,weight:"520 lbs",gallons:220,electrical:"240V/30A"}), 14],
    ["Clarity Spas Precision 8", "hot_tub", 9995, 7995, IMG_HT, JSON.stringify({series:"Clarity",seats:5,dimensions:"84 x 84 x 34 in",jets:32,weight:"700 lbs",gallons:325,electrical:"240V/40A"}), 15],
    ["Clarity Spas Precision 7", "hot_tub", 8495, 6995, IMG_HT, JSON.stringify({series:"Clarity",seats:4,dimensions:"78 x 78 x 33 in",jets:28,weight:"620 lbs",gallons:275,electrical:"240V/30A"}), 16],

    // ── Getaway Spas (Entry-Level Hot Tubs) ──────────────────
    ["Getaway Bar Harbor LE", "hot_tub", 5995, 4495, null, JSON.stringify({series:"Getaway",seats:4,dimensions:"75 x 75 x 33 in",jets:20,weight:"500 lbs",gallons:240,electrical:"240V/30A"}), 17],
    ["Getaway Bar Harbor SE", "hot_tub", 4995, 3995, null, JSON.stringify({series:"Getaway",seats:4,dimensions:"75 x 75 x 33 in",jets:16,weight:"475 lbs",gallons:230,electrical:"120V/20A plug-and-play"}), 18],
    ["Getaway Ocho Rios SE", "hot_tub", 5495, 4295, null, JSON.stringify({series:"Getaway",seats:5,dimensions:"78 x 78 x 33 in",jets:18,weight:"510 lbs",gallons:250,electrical:"120V/20A plug-and-play"}), 19],
    ["Getaway San Miguel", "hot_tub", 4495, 3495, null, JSON.stringify({series:"Getaway",seats:3,dimensions:"69 x 69 x 29 in",jets:12,weight:"350 lbs",gallons:165,electrical:"120V/15A plug-and-play"}), 20],

    // ── Michael Phelps Swim Spas ─────────────────────────────
    ["MP Signature Pro Swim Spa", "swim_spa", 54995, 47995, IMG_SS, JSON.stringify({series:"Michael Phelps",length:"19ft x 8ft",seats:4,swim_jets:"Wave XP Pro system",therapy_jets:38,gallons:2150,electrical:"240V/100A"}), 21],

    // ── H2X Challenger Series (Performance Swim Spas) ────────
    ["H2X Challenger 21 D", "swim_spa", 42995, 36995, IMG_SS, JSON.stringify({series:"H2X Challenger",length:"21ft x 8ft",seats:4,swim_jets:8,therapy_jets:32,gallons:2400,electrical:"240V/100A",dual_temp:true}), 22],
    ["H2X Challenger 19 Deep MAX", "swim_spa", 38995, 33495, IMG_SS, JSON.stringify({series:"H2X Challenger",length:"19ft x 8ft",seats:4,swim_jets:8,therapy_jets:28,gallons:2200,electrical:"240V/80A",dual_temp:true}), 23],
    ["H2X Challenger 15 D", "swim_spa", 29995, 25495, IMG_SS, JSON.stringify({series:"H2X Challenger",length:"15ft x 7ft 8in",seats:3,swim_jets:6,therapy_jets:24,gallons:1650,electrical:"240V/60A",dual_temp:true}), 24],

    // ── H2X Trainer Series (Entry Swim Spas) ─────────────────
    ["H2X Trainer 21 Deep", "swim_spa", 36995, 31495, IMG_SS, JSON.stringify({series:"H2X Trainer",length:"21ft x 8ft",seats:4,swim_jets:6,therapy_jets:28,gallons:2300,electrical:"240V/80A"}), 25],
    ["H2X Trainer 19 Deep MAX", "swim_spa", 33995, 28995, IMG_SS, JSON.stringify({series:"H2X Trainer",length:"19ft x 8ft",seats:4,swim_jets:6,therapy_jets:24,gallons:2100,electrical:"240V/80A"}), 26],
    ["H2X Trainer 15 Deep", "swim_spa", 25995, 21995, IMG_SS, JSON.stringify({series:"H2X Trainer",length:"15ft x 7ft 8in",seats:3,swim_jets:4,therapy_jets:20,gallons:1600,electrical:"240V/50A"}), 27],
    ["H2X Trainer 15", "swim_spa", 22995, 19495, null, JSON.stringify({series:"H2X Trainer",length:"15ft x 7ft 8in",seats:3,swim_jets:4,therapy_jets:16,gallons:1500,electrical:"240V/50A"}), 28],
    ["H2X Trainer 12", "swim_spa", 18995, 15995, null, JSON.stringify({series:"H2X Trainer",length:"12ft x 7ft 8in",seats:2,swim_jets:3,therapy_jets:12,gallons:1100,electrical:"240V/40A"}), 29],

    // ── Chilly GOAT Cold Tubs ────────────────────────────────
    ["Chilly GOAT Alpine Glacier", "cold_plunge", 9495, 6995, IMG_CP, JSON.stringify({series:"Chilly GOAT",temp:"40F min",dimensions:"76 x 42 x 30 in",recovery:"Full body immersion",cooling:"Built-in chiller",filtration:"Ozone + UV",electrical:"120V/15A"}), 30],
    ["Chilly GOAT Valaris", "cold_plunge", 14995, 10995, IMG_CP, JSON.stringify({series:"Chilly GOAT",temp:"40F cold / 104F hot",dimensions:"94 x 56 x 32 in",recovery:"Hot + Cold dual zone",cooling:"Built-in chiller + heater",filtration:"Ozone + UV",electrical:"240V/40A"}), 31],
  ];
  for (const p of products) {
    await run("INSERT INTO products (name, category, msrp, floor_price, image_url, specs_json, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)", p);
  }

  // ─── Options ──────────────────────────────────────────────
  const options = [
    // Universal options
    ["Chemical Startup Kit", 149, null, 1],
    ["Premium LED Lighting Package", 395, null, 2],
    ["Bluetooth Audio System", 495, null, 3],
    ["Ozone + UV Water Purification", 595, null, 4],
    ["WiFi Smart Module", 295, null, 5],
    ["Commercial Warranty Upgrade", 495, null, 6],
    ["Doc Fee", 295, null, 7],
    // Hot tub specific
    ["CoverSmart Top Cover", 895, "hot_tub", 8],
    ["Cover Lifter", 349, "hot_tub", 9],
    ["Steps with Handrail", 399, "hot_tub", 10],
    ["Spa Umbrella w/ Base", 695, "hot_tub", 11],
    ["EcoPur Charge Filter Set", 129, "hot_tub", 12],
    // Swim spa specific
    ["Smart Top Cover w/ Handrail", 1295, "swim_spa", 13],
    ["Cover Lifter Cradle", 449, "swim_spa", 14],
    ["Swim Tether System", 149, "swim_spa", 15],
    ["Resistance Band Kit", 79, "swim_spa", 16],
    ["Aquatic Exercise Mat", 99, "swim_spa", 17],
    // Cold plunge specific
    ["Insulated Hard Cover", 395, "cold_plunge", 18],
    ["Performance Filtration Kit", 199, "cold_plunge", 19],
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
    [1, 1, "10:30", "H2X Trainer 15 Deep", "Cascade High-Intent", 3, 1, "scheduled", "Brock"],
    [2, 1, "11:15", "Twilight Series TS 7.25", "Retargeting Flow", 2, 0, "scheduled", "Brock"],
    [3, 1, "13:00", "H2X Challenger 21 D", "Showroom Referral", 0, 0, "scheduled", "Alex"],
    [4, 1, "10:00", "Legend LSX 900", "Spring Expo Email Blast", 3, 1, "checked_in", "Brock"],
    [6, 1, "11:45", "MP Signature Pro Swim Spa", "Email Campaign Q1", 4, 2, "scheduled", "Alex"],
    [7, 1, "14:00", "H2X Challenger 15 D", "Cascade Re-engagement", 1, 1, "scheduled", "Brock"],
    [9, 1, "14:30", "Chilly GOAT Alpine Glacier", "Cold Therapy Campaign", 2, 0, "scheduled", "Alex"],
    [11, 1, "15:00", "Twilight Series TS 8.25", "Spring Expo Email Blast", 5, 3, "scheduled", "Brock"],
  ];
  for (const a of appts) await run("INSERT INTO appointments (customer_id, event_id, appointment_time, product_interest, cascade_source, cascade_emails_opened, cascade_texts_sent, status, assigned_rep) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", a);

  // ─── Leads ────────────────────────────────────────────────
  const leadData = [
    [4, 1, "cascade", "Legend LSX 900", "closed_won", "Brock", "Very interested. Backyard measured. Wants financing options."],
    [5, 1, "walk-in", "Twilight Series TS 7.25", "new", "Brock", "Walked in, browsing. Seemed price-sensitive."],
    [8, 1, "walk-in", "Chilly GOAT Alpine Glacier", "new", "Alex", "Asked about recovery benefits. Crossfit athlete."],
    [10, 1, "referral", "MP Signature Pro Swim Spa", "negotiating", "Alex", "Referred by Robert Chen. Wants MP Signature Pro. Discussing GreenSky financing."],
    [1, 1, "cascade", "H2X Trainer 15 Deep", "appointment_set", "Brock", null],
    [2, 1, "cascade", "Twilight Series TS 7.25", "appointment_set", "Brock", null],
    [12, 1, "walk-in", "Clarity Spas Balance 8", "follow_up", "Brock", "Needs to discuss with spouse. Call back Thursday."],
    [6, 1, "cascade", "MP Signature Pro Swim Spa", "showed", "Alex", "Checked in. Looking at swim spas for home gym replacement."],
  ];
  for (const l of leadData) await run("INSERT INTO leads (customer_id, event_id, source, product_interest, status, assigned_rep, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)", l);

  // ─── Existing quote + order with payment history ──────────
  // Legend LSX 900 is product_id 7 — Maria Lopez closed deal
  await run(`INSERT INTO quotes (customer_id, product_id, lead_id, options_json, discounts_json, subtotal, options_total, discounts_total, tax_rate, tax_amount, total, expo_discount, status)
    VALUES (4, 7, 1, '["Premium LED Lighting Package","Bluetooth Audio System","Ozone + UV Water Purification","CoverSmart Top Cover","Cover Lifter"]', '["Factory Rebate","Paid in Full"]', 15995, 2729, 750, 0.0825, 1482.88, 19456.88, true, 'accepted')`);

  await run(`INSERT INTO orders (quote_id, lead_id, customer_id, contract_number, total, total_paid, balance, model_type, location, status)
    VALUES (1, 1, 4, 'AS-2026-0831', 19456.88, 11674.13, 7782.75, 'Factory Build', 'Dallas Main', 'partially_paid')`);

  // Payment history: deposit + two installments
  await run(`INSERT INTO payments (order_id, amount, payment_method, payment_type, reference, notes) VALUES
    (1, 5836.06, 'credit_card', 'deposit', 'TXN-20260315-001', 'Initial deposit at expo — 30%')`);
  await run(`INSERT INTO payments (order_id, amount, payment_method, payment_type, reference, notes) VALUES
    (1, 3000.00, 'ach', 'installment', 'TXN-20260322-002', 'Second payment — ACH bank transfer')`);
  await run(`INSERT INTO payments (order_id, amount, payment_method, payment_type, reference, notes) VALUES
    (1, 2838.07, 'credit_card', 'installment', 'TXN-20260328-003', 'Third payment — card on file')`);

  console.log("Database seeded with demo data.");
}
