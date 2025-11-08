#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <MPU6050_light.h>

#define I2C_SDA_PIN 8
#define I2C_SCL_PIN 9

// Wi-Fi credentials
const char* ssid = "Anuj";
const char* password = "anujanuj";

// MPU6050 setup
MPU6050 mpu(Wire);

// Web server on port 80
WebServer server(80);

float ax, ay, az, gx, gy, gz;

// CORS headers for cross-origin requests
void enableCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleRoot() {
  enableCORS();
  String html = R"rawliteral(
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MPU6050 Dashboard</title>
    <style>
      body { font-family: Arial; background:#121212; color:#fff; text-align:center; }
      .card { background:#1e1e1e; padding:20px; margin:20px auto; border-radius:15px; width:320px; box-shadow:0 0 10px #00ffcc55; }
      h2 { color:#00ffcc; }
      .value { font-size:20px; }
      button { background:#00ffcc; border:none; padding:10px 20px; border-radius:8px; font-size:16px; cursor:pointer; }
      button:hover { background:#00e6b8; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>MPU6050 Live Data</h2>
      <div class="value" id="acc"></div>
      <div class="value" id="gyro"></div>
      <br>
      <button onclick="refreshData()">Refresh</button>
    </div>

    <script>
      async function refreshData() {
        const res = await fetch('/data');
        const data = await res.json();
        document.getElementById('acc').innerHTML = `Accel → X:${data.ax.toFixed(2)} | Y:${data.ay.toFixed(2)} | Z:${data.az.toFixed(2)}`;
        document.getElementById('gyro').innerHTML = `Gyro → X:${data.gx.toFixed(2)} | Y:${data.gy.toFixed(2)} | Z:${data.gz.toFixed(2)}`;
      }
      setInterval(refreshData, 1000);
      refreshData();
    </script>
  </body>
  </html>
  )rawliteral";

  server.send(200, "text/html", html);
}

void handleData() {
  enableCORS();  // Add CORS headers
  String json = "{";
  json += "\"ax\":" + String(ax) + ",";
  json += "\"ay\":" + String(ay) + ",";
  json += "\"az\":" + String(az) + ",";
  json += "\"gx\":" + String(gx) + ",";
  json += "\"gy\":" + String(gy) + ",";
  json += "\"gz\":" + String(gz);
  json += "}";
  server.send(200, "application/json", json);
}

void handleOptions() {
  enableCORS();
  server.send(204);  // No content
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\nConnecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi Connected!");
  Serial.print("🌐 IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.println("📱 Share this IP with other devices on the same network!");

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  if (mpu.begin() != 0) {
    Serial.println("❌ MPU6050 init failed");
    while (1);
  }

  mpu.calcOffsets();
  Serial.println("✅ MPU6050 ready");

  // Web routes
  server.on("/", handleRoot);
  server.on("/data", handleData);
  server.on("/data", HTTP_OPTIONS, handleOptions);  // Handle preflight
  server.begin();
  Serial.println("✅ Web server started");
}

void loop() {
  mpu.update();
  ax = mpu.getAccX();
  ay = mpu.getAccY();
  az = mpu.getAccZ();
  gx = mpu.getGyroX();
  gy = mpu.getGyroY();
  gz = mpu.getGyroZ();

  server.handleClient();
}
