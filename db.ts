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
    // ── Twilight Series (Premium Hot Tubs) ── real specs from masterspas.com
    ["Twilight Series TS 8.25", "hot_tub", 16995, 14495, IMG_HT, JSON.stringify({series:"Twilight",seats:7,dimensions:"94 x 94 x 38 in",jets:43,dry_weight:"1,100 lbs",full_weight:"5,690 lbs",gallons:395,electrical:"240V/50A",features:"Orion Light System, Master Force Bio-Magnetic Therapy, Master Blaster Foot Massage, Bluetooth stereo w/ subwoofer"}), 1],
    ["Twilight Series TS 8.2", "hot_tub", 15495, 12995, IMG_HT, JSON.stringify({series:"Twilight",seats:6,dimensions:"94 x 94 x 38 in",jets:46,dry_weight:"1,065 lbs",full_weight:"5,345 lbs",gallons:380,electrical:"240V/50A",features:"Orion Light System, Master Blaster Foot Massage, Bluetooth stereo"}), 2],
    ["Twilight Series TS 7.25", "hot_tub", 13995, 11495, IMG_HT, JSON.stringify({series:"Twilight",seats:7,dimensions:"84 x 84 x 38 in",jets:37,dry_weight:"919 lbs",full_weight:"4,760 lbs",gallons:305,electrical:"240V/40A",features:"Master Force Bio-Magnetic Therapy, full-foam insulation"}), 3],
    ["Twilight Series TS 7.2", "hot_tub", 12495, 10495, IMG_HT, JSON.stringify({series:"Twilight",seats:6,dimensions:"84 x 84 x 38 in",jets:38,dry_weight:"980 lbs",full_weight:"4,635 lbs",gallons:305,electrical:"240V/40A",features:"Bluetooth stereo w/ 4 speakers + subwoofer"}), 4],
    ["Twilight Series TS 67.25", "hot_tub", 11495, 9495, IMG_HT, JSON.stringify({series:"Twilight",seats:5,dimensions:"70 x 84 x 34 in",jets:28,dry_weight:"809 lbs",full_weight:"3,740 lbs",gallons:240,electrical:"240V/30A",features:"Compact footprint, full Twilight features"}), 5],
    ["Twilight Series TS 6.2", "hot_tub", 10995, 8995, IMG_HT, JSON.stringify({series:"Twilight",seats:5,dimensions:"78 x 78 x 34 in",jets:30,dry_weight:"755 lbs",full_weight:"3,770 lbs",gallons:250,electrical:"240V/30A",features:"Energy-efficient, full-foam insulation"}), 6],
    ["Twilight Series TS 240X", "hot_tub", 9495, 7495, IMG_HT, JSON.stringify({series:"Twilight",seats:3,dimensions:"78 x 78 x 34 in",jets:26,dry_weight:"715 lbs",full_weight:"2,980 lbs",gallons:205,electrical:"240V/30A",features:"Therapy-focused, deep contoured seats"}), 7],

    // ── Michael Phelps Legend Series (Luxury Hot Tubs) ── real specs
    ["Legend LSX 900", "hot_tub", 21995, 18495, IMG_HT, JSON.stringify({series:"Legend",seats:8,dimensions:"108 x 94 x 38 in",jets:72,dry_weight:"1,485 lbs",full_weight:"7,055 lbs",gallons:490,electrical:"240V/50A",features:"StressRelief Neck & Shoulder seats, Master Blaster foot therapy, Icynene insulation, Wi-Fi capable"}), 8],
    ["Legend LSX 850", "hot_tub", 19995, 16995, IMG_HT, JSON.stringify({series:"Legend",seats:7,dimensions:"94 x 94 x 38 in",jets:59,dry_weight:"1,170 lbs",full_weight:"5,760 lbs",gallons:395,electrical:"240V/50A",features:"StressRelief seats, premium LED, Wi-Fi capable"}), 9],
    ["Legend LSX 800", "hot_tub", 18495, 15495, IMG_HT, JSON.stringify({series:"Legend",seats:6,dimensions:"94 x 94 x 38 in",jets:70,dry_weight:"1,330 lbs",full_weight:"5,860 lbs",gallons:410,electrical:"240V/50A",features:"Most jets in class, advanced water circulation"}), 10],
    ["Legend LSX 700", "hot_tub", 15995, 13495, IMG_HT, JSON.stringify({series:"Legend",seats:5,dimensions:"84 x 84 x 38 in",jets:62,dry_weight:"1,095 lbs",full_weight:"4,565 lbs",gallons:305,electrical:"240V/40A",features:"Premium therapy, compact Legend footprint"}), 11],
    ["Legend LSX 30", "hot_tub", 16995, 14295, IMG_HT, JSON.stringify({series:"Legend",seats:5,dimensions:"94 x 94 x 38 in",jets:63,dry_weight:"1,128 lbs",full_weight:"4,930 lbs",gallons:345,electrical:"240V/50A",features:"Lounge seat, open seating design"}), 12],

    // ── Clarity Spas (Mid-Range) ── real specs
    ["Clarity Spas Balance 9", "hot_tub", 13995, 11495, IMG_HT, JSON.stringify({series:"Clarity",seats:8,dimensions:"91 x 91 x 36 in",jets:45,electrical:"240V/40A",features:"Large capacity, open seating, waterfall, EcoPur Charge filtration"}), 13],
    ["Clarity Spas Balance 8", "hot_tub", 11995, 9995, IMG_HT, JSON.stringify({series:"Clarity",seats:7,dimensions:"84 x 84 x 34 in",jets:40,electrical:"240V/40A",features:"Best-selling Clarity, ergonomic StressRelief seats, full-foam insulation"}), 14],
    ["Clarity Spas Balance 7", "hot_tub", 9995, 7995, IMG_HT, JSON.stringify({series:"Clarity",seats:6,dimensions:"78 x 78 x 34 in",jets:35,electrical:"240V/30A",features:"StressRelief seats, EcoPur Charge filtration"}), 15],
    ["Clarity Spas Balance 6 CS", "hot_tub", 8495, 6995, IMG_HT, JSON.stringify({series:"Clarity",seats:5,dimensions:"72 x 72 x 32 in",jets:30,electrical:"240V/30A or 120V plug-and-play",features:"Waterfall, cup holders, convertible electrical"}), 16],
    ["Clarity Spas Precision 8", "hot_tub", 12495, 10495, IMG_HT, JSON.stringify({series:"Clarity",seats:7,dimensions:"84 x 84 x 34 in",jets:40,electrical:"240V/40A",features:"Open seating, large footwell, therapy-focused"}), 17],
    ["Clarity Spas Precision 7", "hot_tub", 10495, 8495, IMG_HT, JSON.stringify({series:"Clarity",seats:6,dimensions:"78 x 78 x 34 in",jets:35,electrical:"240V/30A",features:"Open seating, StressRelief seats"}), 18],

    // ── Getaway Spas (Entry-Level / Plug-and-Play) ── real specs
    ["Getaway Bar Harbor LE", "hot_tub", 7995, 5995, null, JSON.stringify({series:"Getaway",seats:5,dimensions:"78 x 78 x 34 in",jets:40,electrical:"240V/30A",features:"Largest Getaway, full-size lounge, cascading waterfall, Colorscape LED"}), 19],
    ["Getaway Bar Harbor SE", "hot_tub", 5995, 4495, null, JSON.stringify({series:"Getaway",seats:5,dimensions:"78 x 78 x 34 in",jets:25,electrical:"120V/20A plug-and-play",features:"Cascading waterfall, lightweight, portable"}), 20],
    ["Getaway Ocho Rios CS", "hot_tub", 6495, 4995, null, JSON.stringify({series:"Getaway",seats:4,dimensions:"75 x 75 x 33 in",jets:29,electrical:"240V/30A or 120V plug-and-play",features:"Waterfall, backlit cup holders, convertible electrical"}), 21],
    ["Getaway Ocho Rios SE", "hot_tub", 4995, 3995, null, JSON.stringify({series:"Getaway",seats:4,dimensions:"75 x 75 x 33 in",jets:17,electrical:"120V/20A plug-and-play",features:"Lightweight, portable, EcoPur Charge filtration"}), 22],
    ["Getaway San Miguel", "hot_tub", 4495, 3495, null, JSON.stringify({series:"Getaway",seats:3,dimensions:"69 x 69 x 29 in",jets:17,electrical:"120V/15A plug-and-play",features:"Most compact Master Spas, perfect for small spaces"}), 23],

    // ── Michael Phelps Swim Spas ── real specs
    ["MP Momentum Deep", "swim_spa", 49995, 43995, IMG_SS, JSON.stringify({series:"Michael Phelps",length:"231 x 94 x 60 in (19ft)",seats:4,jets:"45 swim + 36 therapy + 2 Master Blasters",dry_weight:"3,700 lbs",full_weight:"24,205 lbs",gallons:2325,electrical:"240V/100A",features:"Wave Propulsion system, dual temp zones, Mast3rPur Water Management, largest domestic swim spa"}), 24],
    ["MP Force Deep", "swim_spa", 39995, 34995, IMG_SS, JSON.stringify({series:"Michael Phelps",length:"220 x 94 x 58 in (17ft)",jets:"Wave Propulsion system",dry_weight:"3,500 lbs",gallons:2000,electrical:"240V/80A",features:"Wave Propulsion, fitness-focused, dual temperature zones"}), 25],

    // ── H2X Challenger Series (Performance Swim Spas) ── real specs
    ["H2X Challenger 19D MAX", "swim_spa", 39995, 34495, IMG_SS, JSON.stringify({series:"H2X Challenger",length:"231 x 94 x 60 in (19ft)",seats:4,jets:"47 total, 3 pumps",dry_weight:"3,335 lbs",full_weight:"24,230 lbs",gallons:2350,electrical:"240V/80A",features:"Largest swim area, Xtreme Therapy Cove, variable speed, VIP airless jets"}), 26],
    ["H2X Challenger 15 D", "swim_spa", 29995, 25495, IMG_SS, JSON.stringify({series:"H2X Challenger",length:"180 x 94 x 51 in (15ft)",seats:3,jets:"Obstacle-free swim area",gallons:1500,electrical:"240V/60A",features:"Smallest Challenger footprint, strategic massage jets, dual temp"}), 27],

    // ── H2X Trainer Series (Entry Swim Spas) ── real specs
    ["H2X Trainer 21", "swim_spa", 36995, 31495, IMG_SS, JSON.stringify({series:"H2X Trainer",length:"257 x 94 x 51 in (21ft)",seats:4,jets:"Swim + therapy zones",gallons:2400,electrical:"240V/80A",features:"Spacious swim area, dedicated hot tub section, sun lounge"}), 28],
    ["H2X Trainer 19D MAX", "swim_spa", 33995, 28995, IMG_SS, JSON.stringify({series:"H2X Trainer",length:"231 x 94 x 60 in (19ft)",seats:4,jets:"31 therapy jets",gallons:2300,electrical:"240V/80A",features:"Full hydrotherapy, modern design, family-size"}), 29],
    ["H2X Trainer 15D", "swim_spa", 25995, 21995, IMG_SS, JSON.stringify({series:"H2X Trainer",length:"180 x 94 x 51 in (15ft)",seats:3,jets:"4 VIP swim jets + air-injected therapy",gallons:1500,electrical:"240V/50A",features:"Endless swim current, H2Xercise Fitness System, compact"}), 30],
    ["H2X Trainer 15", "swim_spa", 22995, 19495, null, JSON.stringify({series:"H2X Trainer",length:"180 x 94 x 48 in (15ft)",seats:3,jets:"4 swim jets",gallons:1400,electrical:"240V/50A",features:"Entry swim spa, phone control, temperature app"}), 31],
    ["H2X Trainer 12", "swim_spa", 18995, 15995, null, JSON.stringify({series:"H2X Trainer",length:"145 x 94 x 48 in (12ft)",seats:2,jets:"3 swim jets",gallons:1100,electrical:"240V/40A",features:"Most compact swim spa, ideal for small backyards"}), 32],

    // ── Chilly GOAT Cold Tubs ── real specs + prices from chillygoattubs.com
    ["Chilly GOAT Alpine Glacier", "cold_plunge", 9495, 6995, IMG_CP, JSON.stringify({series:"Chilly GOAT",temp:"40-104F",dimensions:"80 x 60 x 32 in",chiller:"2.1 hp integrated",filtration:"UV filtration (ozone-free)",electrical:"120V/15A",features:"Wi-Fi app control, minimal chemicals, contemporary cabinet, 2yr shell warranty"}), 33],
    ["Chilly GOAT Matterhorn", "cold_plunge", 4995, 3995, IMG_CP, JSON.stringify({series:"Chilly GOAT",temp:"40-104F",dimensions:"73 x 44 x 30 in",chiller:"1.0 hp external",filtration:"Standard",electrical:"120V/15A",features:"Durable molded design, enhanced insulation, 1yr equipment warranty"}), 34],
    ["Chilly GOAT Valaris", "cold_plunge", 14995, 10995, IMG_CP, JSON.stringify({series:"Chilly GOAT",temp:"40F cold / 104F hot",dimensions:"94 x 56 x 32 in",chiller:"Built-in chiller + heater",filtration:"UV + ozone",electrical:"240V/40A",features:"Hot + Cold dual zone combo, ultimate recovery station"}), 35],
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
