import axios from "axios";

const BACKEND_URL = "http://localhost:8000/data";

function randomMPUData() {
  // Generate pseudo-random MPU data
  return {
    device_id: "SIM_DEVICE_1",
    ax: Math.random() * 5,
    ay: Math.random() * 5,
    az: Math.random() * 5,
    gx: Math.random() * 2,
    gy: Math.random() * 2,
    gz: Math.random() * 2,
    temperature_c: 20 + Math.random() * 10,
    humidity_percent: 40 + Math.random() * 30,
  };
}

async function sendData() {
  const data = randomMPUData();
  try {
    const res = await axios.post(BACKEND_URL, data);
    console.log(
      `[SENT] ax=${data.ax.toFixed(2)} ay=${data.ay.toFixed(2)} | condition=${res.data.prediction.condition}`
    );
  } catch (err) {
    console.error("❌ Failed to send data:", err.message);
  }
}

// Send new data every 2 seconds
setInterval(sendData, 2000);
