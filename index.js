import express from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const ALLOWED_DATES = new Set(["2026-11-20", "2026-11-21", "2026-11-22"]);
const STATUS = new Set(["Pending", "Confirmed", "Cancelled"]);

function clean(s, max = 200) { return typeof s === "string" ? s.trim().slice(0, max) : ""; }

function validDate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && ALLOWED_DATES.has(s); }

function auth(req, res, next) {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    try {
        req.admin = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch { res.status(401).json({ message: "Unauthorized" }); }
}

export function registrationsRouter(pool) {
    const r = express.Router();
    r.post("/", async(req, res, next) => {
        try {
            const familyCode = clean(req.body.familyCode, 12),
                memberName = clean(req.body.memberName, 100),
                phoneNumber = clean(req.body.phoneNumber, 10);
            const guestCount = Number(req.body.guestCount),
                checkIn = req.body.checkIn,
                checkOut = req.body.checkOut;
            if (!familyCode || !memberName || !/^\d{10}$/.test(phoneNumber) || !Number.isInteger(guestCount) || guestCount < 1 || guestCount > 20 || !validDate(checkIn) || !validDate(checkOut) || checkOut < checkIn)
                return res.status(400).json({ message: "Invalid registration details." });
            const exists = await pool.query("SELECT id FROM registrations WHERE family_code=$1 AND phone_number=$2 AND status <> 'Cancelled' LIMIT 1", [familyCode, phoneNumber]);
            if (exists.rowCount) return res.status(409).json({ message: "A registration already exists for this family code and phone number." });
            const result = await pool.query(
                `INSERT INTO registrations (family_code,member_name,phone_number,guest_count,check_in,check_out,status)
         VALUES($1,$2,$3,$4,$5,$6,'Pending') RETURNING id, registration_id AS "registrationId", family_code AS "familyCode", member_name AS "memberName", phone_number AS "phoneNumber", guest_count AS "guestCount", check_in AS "checkIn", check_out AS "checkOut", status`, [familyCode, memberName, phoneNumber, guestCount, checkIn, checkOut]);
            res.status(201).json({ registration: result.rows[0] });
        } catch (e) { next(e); }
    });
    return r;
}

export function adminRouter(pool) {
    const r = express.Router();
    r.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), async(req, res, next) => {
        try {
            const username = clean(req.body.username, 100),
                password = typeof req.body.password === "string" ? req.body.password : "";
            const hash = process.env.ADMIN_PASSWORD_HASH;
            if (!hash || username !== process.env.ADMIN_USERNAME || !(await bcrypt.compare(password, hash))) return res.status(401).json({ message: "Invalid username or password." });
            const token = jwt.sign({ sub: username, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "8h" });
            res.json({ token });
        } catch (e) { next(e); }
    });

    r.get("/registrations", auth, async(req, res, next) => {
        try {
            const search = clean(req.query.search, 100),
                status = clean(req.query.status, 20),
                date = clean(req.query.date, 10);
            const where = [],
                params = [];
            if (search) {
                params.push(`%${search}%`);
                where.push(`(family_code ILIKE $${params.length} OR member_name ILIKE $${params.length} OR phone_number ILIKE $${params.length} OR registration_id ILIKE $${params.length})`);
            }
            if (STATUS.has(status)) {
                params.push(status);
                where.push(`status=$${params.length}`);
            }
            if (validDate(date)) {
                params.push(date);
                where.push(`check_in <= $${params.length} AND check_out >= $${params.length}`);
            }
            const clause = where.length ? "WHERE " + where.join(" AND ") : "";
            const q = await pool.query(`SELECT id,registration_id AS "registrationId",family_code AS "familyCode",member_name AS "memberName",phone_number AS "phoneNumber",guest_count AS "guestCount",check_in AS "checkIn",check_out AS "checkOut",status FROM registrations ${clause} ORDER BY created_at DESC`, params);
            const stats = await pool.query(`SELECT COUNT(*)::int total, COALESCE(SUM(guest_count),0)::int guests, COUNT(*) FILTER(WHERE status='Confirmed')::int confirmed, COUNT(*) FILTER(WHERE status='Pending')::int pending FROM registrations ${clause}`, params);
            res.json({ registrations: q.rows, stats: stats.rows[0] });
        } catch (e) { next(e); }
    });

    r.patch("/registrations/:id", auth, async(req, res, next) => {
        try {
            const status = clean(req.body.status, 20);
            if (!STATUS.has(status)) return res.status(400).json({ message: "Invalid status." });
            const q = await pool.query(`UPDATE registrations SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,registration_id AS "registrationId",status`, [status, req.params.id]);
            if (!q.rowCount) return res.status(404).json({ message: "Registration not found." });
            res.json({ registration: q.rows[0] });
        } catch (e) { next(e); }
    });

    r.get("/export", auth, async(req, res, next) => {
        try {
            const q = await pool.query(`SELECT registration_id,family_code,member_name,phone_number,guest_count,check_in,check_out,status,created_at FROM registrations ORDER BY created_at DESC`);
            const header = ["Registration ID", "Family Code", "Member Name", "Phone", "Guest Count", "Check-in", "Check-out", "Status", "Created At"];
            const csv = [header, ...q.rows.map(x => [x.registration_id, x.family_code, x.member_name, x.phone_number, x.guest_count, x.check_in.toISOString().slice(0, 10), x.check_out.toISOString().slice(0, 10), x.status, x.created_at.toISOString()])].map(row => row.map(v => `"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", 'attachment; filename="asthi-ahob-registrations.csv"');
            res.send(csv);
        } catch (e) { next(e); }
    });
    return r;
}