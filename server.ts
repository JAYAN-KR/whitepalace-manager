import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import Razorpay from "razorpay";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Razorpay instance
  let razorpay: Razorpay | null = null;

  const getRazorpay = () => {
    if (!razorpay) {
      const key_id = process.env.RAZORPAY_KEY_ID;
      const key_secret = process.env.RAZORPAY_KEY_SECRET;
      if (!key_id || !key_secret) {
        console.warn("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing. Razorpay features will be disabled.");
        return null;
      }
      razorpay = new Razorpay({
        key_id,
        key_secret,
      });
    }
    return razorpay;
  };

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Create Razorpay Order
  app.post("/api/razorpay/order", async (req, res) => {
    const { amount, currency, receipt } = req.body;
    const rp = getRazorpay();

    if (!rp) {
      return res.status(500).json({ error: "Razorpay is not configured on the server." });
    }

    try {
      const order = await rp.orders.create({
        amount: amount * 100, // Razorpay expects amount in paise
        currency: currency || "INR",
        receipt: receipt || `receipt_${Date.now()}`,
      });
      res.json(order);
    } catch (error) {
      console.error("Razorpay order creation failed:", error);
      res.status(500).json({ error: "Failed to create Razorpay order" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
