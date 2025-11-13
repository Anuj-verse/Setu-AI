const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const nodemailer = require('nodemailer'); // 📧 For Email Alerts
require('dotenv').config(); // 🔐 For environment variables

const app = express();
const PORT = 3001;

// --- CONFIGURATION & STATE ---

// Middleware
app.use(cors({
    origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// Store latest sensor data
let latestSensorData = {
    infrastructure_id: "BRIDGE_001",
    location: "Delhi Metro Bridge",
    timestamp: Date.now(),
    status: "normal",
    sensors: {
        strain: 800,
        vibration: 1.2,
        temperature: 25.0,
        accelerometer: {
            x: 0,
            y: 0,
            z: 0
        }
    },
    system: {
        uptime: 0,
        free_memory: 1500,
        battery_level: 95
    }
};

// Alert System State
let isCriticalAlertSent = false; // Flag to prevent spamming alerts
const ALERT_EMAIL_RECIPIENT = process.env.RECIPIENT_EMAIL || 'default_alert@example.com'; 

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Serial port configuration
let serialPort = null;
let parser = null;
const ARDUINO_PORTS = ['COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8']; // Common Windows ports

// --- HELPER FUNCTIONS ---

/**
 * Sends a critical alert email when the bridge status is "critical".
 * Uses the latestSensorData for context.
 */
async function sendCriticalAlert(data) {
    if (!ALERT_EMAIL_RECIPIENT || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ ALERT: Email credentials/recipient not fully configured in .env. Skipping email alert.');
        return;
    }

    const mailOptions = {
        from: `"Setu AI Bridge Monitor" <${process.env.EMAIL_USER}>`,
        to: ALERT_EMAIL_RECIPIENT,
        subject: `🚨 CRITICAL ALERT: BRIDGE_001 - ${data.location}`,
        html: `
            <h1>CRITICAL STRUCTURAL WARNING</h1>
            <p><strong>Infrastructure ID:</strong> ${data.infrastructure_id}</p>
            <p><strong>Location:</strong> ${data.location}</p>
            <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
            <hr>
            <h2>Sensor Readings:</h2>
            <ul>
                <li><strong>Strain:</strong> ${data.sensors.strain} µε (Microstrain)</li>
                <li><strong>Vibration:</strong> ${data.sensors.vibration} Hz</li>
                <li><strong>Temperature:</strong> ${data.sensors.temperature}°C</li>
            </ul>
            <p style="color: red; font-weight: bold;">Immediate action may be required.</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✉️ CRITICAL ALERT EMAIL SENT to ${ALERT_EMAIL_RECIPIENT}`);
        isCriticalAlertSent = true; 
    } catch (error) {
        console.error('❌ Error sending critical email alert:', error.message);
    }
}


/**
 * Logic to check for critical status and trigger alerts.
 * @param {object} data The current sensor data object.
 */
function checkAndTriggerAlert(data) {
    if (data.status === "norm" && !isCriticalAlertSent) {
        sendCriticalAlert(data);
    } else if (data.status !== "critical" && isCriticalAlertSent) {
        // Reset flag once status returns to normal/warning
        isCriticalAlertSent = false;
        console.log('✅ Alert status reset. System stabilized.');
    }
}


/**
 * Broadcasts data to all connected WebSocket clients.
 * @param {object} data The sensor data to send.
 */
function broadcastToClients(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// --- SERIAL COMMUNICATION ---

// Auto-detect Arduino port
async function findArduinoPort() {
    try {
        const ports = await SerialPort.list();
        console.log('Available ports:', ports.map(p => `${p.path} - ${p.manufacturer || 'Unknown'}`));

        const arduinoPorts = ports.filter(port =>
            port.manufacturer && (
                port.manufacturer.toLowerCase().includes('arduino') ||
                port.manufacturer.toLowerCase().includes('ch340') ||
                port.manufacturer.toLowerCase().includes('ftdi') ||
                port.manufacturer.toLowerCase().includes('silicon labs')
            )
        );

        if (arduinoPorts.length > 0) {
            console.log(`Found Arduino-like device on ${arduinoPorts[0].path}`);
            return arduinoPorts[0].path;
        }

        // Fallback to common ports if auto-detect fails
        for (const portPath of ARDUINO_PORTS) {
            const foundPort = ports.find(p => p.path === portPath);
            if (foundPort) {
                console.log(`Using fallback port: ${portPath}`);
                return portPath;
            }
        }

        return null;
    } catch (error) {
        console.error('Error listing ports:', error);
        return null;
    }
}

// Initialize serial connection
async function initializeSerial() {
    const portPath = await findArduinoPort();

    if (!portPath) {
        console.log('⚠️ No Arduino found. Using simulated data.');
        startSimulation();
        return;
    }

    try {
        serialPort = new SerialPort({
            path: portPath,
            baudRate: 115200,
            autoOpen: false
        });

        parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

        serialPort.open((err) => {
            if (err) {
                console.error('Error opening serial port:', err.message);
                console.log('🔄 Falling back to simulated data...');
                startSimulation();
                return;
            }

            console.log(`✅ Connected to Arduino on ${portPath}`);

            // Handle incoming data
            parser.on('data', (data) => {
                try {
                    const jsonData = JSON.parse(data.trim());

                    if (jsonData.sensors && jsonData.timestamp) {
                        latestSensorData = {
                            ...jsonData,
                            timestamp: Date.now() // Use server timestamp
                        };

                        console.log(`📊 Sensor Data: Strain=${jsonData.sensors.strain}µε, Vibration=${jsonData.sensors.vibration}Hz, Temp=${jsonData.sensors.temperature}°C, Status=${jsonData.status}`);
                        
                        // Check for critical status and alert
                        checkAndTriggerAlert(latestSensorData);
                        
                        // Broadcast to all WebSocket clients
                        broadcastToClients(latestSensorData);
                    }
                } catch (error) {
                    // Ignore non-JSON data (initialization messages, etc.)
                    if (data.trim().includes('Setu AI') || data.trim().includes('sensor')) {
                        console.log(`🔧 Arduino: ${data.trim()}`);
                    }
                }
            });

            serialPort.on('close', () => {
                console.log('🔌 Serial connection closed. Switching to simulation...');
                startSimulation();
            });

            serialPort.on('error', (err) => {
                console.error('Serial port error:', err);
                startSimulation();
            });
        });

    } catch (error) {
        console.error('Error initializing serial port:', error);
        startSimulation();
    }
}

// --- SIMULATION MODE ---

// Simulation mode (when no Arduino is connected)
function startSimulation() {
    console.log('🎭 Starting simulation mode...');

    setInterval(() => {
        const time = Date.now() * 0.001;

        // Simulate realistic sensor data
        const baseStrain = 500 + Math.sin(time * 0.1) * 300;
        const spike = Math.random() < 0.05 ? Math.random() * 1500 : 0;
        const strain = Math.max(0, baseStrain + spike + (Math.random() - 0.5) * 100);

        const vibration = Math.abs(Math.sin(time * 0.5) * (1 + strain / 2000));
        const temperature = 20 + Math.sin(time * 0.01) * 5 + (Math.random() - 0.5) * 2;

        // Determine status
        let status = "normal";
        if (strain > 2000 || vibration > 10 || temperature > 60) {
            status = "critical";
        } else if (strain > 1000 || vibration > 5 || temperature > 45) {
            status = "warning";
        }

        latestSensorData = {
            infrastructure_id: "BRIDGE_001",
            location: "Delhi Metro Bridge (Simulated)",
            timestamp: Date.now(),
            status: status,
            sensors: {
                strain: Math.round(strain * 6) / 10,
                vibration: Math.round(vibration * 1000) / 10,
                temperature: Math.round(temperature * 20) / 10,
                accelerometer: {
                    x: (Math.random() - 0.5) * 2,
                    y: (Math.random() - 0.5) * 2,
                    z: 9.8 + (Math.random() - 0.5) * 1
                }
            },
            system: {
                uptime: Math.floor(Date.now() / 1000),
                free_memory: 1500 + Math.floor(Math.random() * 500),
                battery_level: 95 - Math.floor(Math.random() * 10)
            }
        };

        // Check for critical status and alert
        checkAndTriggerAlert(latestSensorData);
        
        broadcastToClients(latestSensorData);
    }, 2000); // Update every 2 seconds
}

// --- WEB SOCKETS ---

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('🔗 Client connected to WebSocket');

    // Send latest data immediately
    ws.send(JSON.stringify(latestSensorData));

    ws.on('close', () => {
        console.log('🔗 Client disconnected from WebSocket');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// --- REST API ENDPOINTS ---

app.get('/api/sensor-data', (req, res) => {
    res.json(latestSensorData);
});

app.get('/api/sensor-data/history', (req, res) => {
    // Simulated historical data
    const history = [];
    const now = Date.now();

    for (let i = 0; i < 20; i++) {
        const time = now - (i * 60000); // 1 minute intervals
        history.unshift({
            timestamp: time,
            strain: 800 + Math.random() * 400,
            vibration: 1 + Math.random() * 3,
            temperature: 22 + Math.random() * 8
        });
    }

    res.json(history);
});

// Arduino control endpoints
app.post('/api/arduino/command', (req, res) => {
    const { command } = req.body;

    if (!serialPort || !serialPort.isOpen) {
        return res.json({ success: false, error: 'Arduino not connected' });
    }

    serialPort.write(`${command}\n`, (err) => {
        if (err) {
            res.json({ success: false, error: err.message });
        } else {
            res.json({ success: true, message: `Command sent: ${command}` });
        }
    });
});

app.post('/api/arduino/tare', (req, res) => {
    if (!serialPort || !serialPort.isOpen) {
        return res.json({ success: false, error: 'Arduino not connected' });
    }

    serialPort.write('TARE\n', (err) => {
        if (err) {
            res.json({ success: false, error: err.message });
        } else {
            res.json({ success: true, message: 'Tare command sent to strain gauge' });
        }
    });
});

app.post('/api/arduino/calibrate', (req, res) => {
    const { weight } = req.body;

    if (!serialPort || !serialPort.isOpen) {
        return res.json({ success: false, error: 'Arduino not connected' });
    }

    if (!weight) {
        serialPort.write('CALIBRATE\n');
        res.json({ success: true, message: 'Calibration mode activated' });
    } else {
        serialPort.write(`WEIGHT:${weight}\n`);
        res.json({ success: true, message: `Calibration weight set: ${weight}` });
    }
});

// System status
app.get('/api/status', (req, res) => {
    res.json({
        server: 'running',
        arduino_connected: serialPort && serialPort.isOpen,
        websocket_clients: wss.clients.size,
        last_data_update: latestSensorData.timestamp,
        uptime: process.uptime()
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// --- SERVER START & SHUTDOWN ---

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Setu AI Backend Server running on port ${PORT}`);
    console.log(`📡 WebSocket server running on port 8080`);
    console.log(`🌐 API available at: http://localhost:${PORT}/api/sensor-data`);

    // Initialize serial connection
    initializeSerial();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down server...');
    if (serialPort && serialPort.isOpen) {
        serialPort.close();
    }
    process.exit(0);
});