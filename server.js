import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import { registrationsRouter, adminRouter } from "./routes/index.js";

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.warn("DATABASE_URL and JWT_SECRET must be configured in production.");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } });

app.set("trust proxy", 1);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(",") : "*" }));
app.use(express.json({ limit: "50kb" }));
app.use("/api/registrations", rateLimit({ windowMs: 15*60*1000, limit: 100, standardHeaders: true, legacyHeaders: false }), registrationsRouter(pool));
app.use("/api/admin", adminRouter(pool));

app.get("/api/health", async (_req,res) => {
  try { await pool.query("SELECT 1"); res.json({ok:true}); }
  catch { res.status(503).json({ok:false}); }
});

app.use((err,_req,res,_next) => {
  console.error(err);
  res.status(500).json({message:"Internal server error."});
});

app.listen(PORT, () => console.log(`ASTHI API listening on port ${PORT}`));
