import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

let latestData = null;
let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 60000; // avoid spam: 1 min between alerts

// --- Helper: compute degradation ---
const computePredictions = (data) => {
  const { ax, ay, az, gx, gy, gz } = data;
  const accel_mag = Math.sqrt(ax * ax + ay * ay + az * az);
  const gyro_mag = Math.sqrt(gx * gx + gy * gy + gz * gz);

  const rawDegradation = (accel_mag * 0.8 + gyro_mag * 0.2) / 5.0;
  const degradation = Math.min(1.0, rawDegradation);

  let condition;
  if (degradation < 0.15) condition = "normal";
  else if (degradation < 0.3) condition = "minor";
  else if (degradation < 0.6) condition = "moderate";
  else condition = "severe";

  const forecast_30d = Math.min(1.0, degradation + 0.01 + Math.random() * 0.09);
  const confidence = 1.0 - Math.random() * 0.08;

  return {
    degradation_score: parseFloat(degradation.toFixed(3)),
    condition,
    forecast_30d: parseFloat(forecast_30d.toFixed(3)),
    confidence: parseFloat(confidence.toFixed(3)),
  };
};

// --- Email Transport ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- API: receive data from ESP32/frontend ---
app.post("/data", async (req, res) => {
  const data = req.body;
  if (!data.ax || !data.ay || !data.az) {
    return res.status(400).json({ error: "Incomplete MPU data" });
  }

  const prediction = computePredictions(data);
  latestData = { ...data, prediction };

  console.log(`[DATA RECEIVED] Condition: ${prediction.condition}`);

  // Send alert if severe
  if (prediction.condition === "severe") {
    const now = Date.now();
    if (now - lastAlertTime > ALERT_COOLDOWN_MS) {
      lastAlertTime = now;

      const mailOptions = {
        from: `"MPU Monitor" <${process.env.EMAIL_USER}>`,
        to: process.env.ALERT_TO,
        subject: "⚠️ Critical Vibration Alert — SEVERE Condition",
        html: `
          <h2>🚨 SEVERE STRESS DETECTED</h2>
          <p><b>Device ID:</b> ${data.device_id || "N/A"}</p>
          <p><b>Degradation Score:</b> ${prediction.degradation_score}</p>
          <p><b>Forecast (30d):</b> ${prediction.forecast_30d}</p>
          <p><b>Confidence:</b> ${prediction.confidence}</p>
          <p><b>Accelerometer:</b> ax=${data.ax}, ay=${data.ay}, az=${data.az}</p>
          <p><b>Gyroscope:</b> gx=${data.gx}, gy=${data.gy}, gz=${data.gz}</p>
          <p style="color:red;">Immediate inspection recommended.</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log("📧 Email alert sent!");
      } catch (err) {
        console.error("❌ Email error:", err);
      }
    }
  }

  res.json({ status: "ok", prediction });
});

// --- API: get latest data for dashboard ---
app.get("/latest", (req, res) => {
  if (!latestData) return res.json({ message: "No data yet" });
  res.json(latestData);
});

// --- Start Server ---
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
