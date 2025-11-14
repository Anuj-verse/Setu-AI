import React, { useState, useEffect, FC, useCallback } from "react";

// --- Interfaces ---
interface MPUData {
    device_id?: string;
    ax: number;
    ay: number;
    az: number;
    gx: number;
    gy: number;
    gz: number;
    temperature_c: number; 
    humidity_percent: number;
}

interface PredictionResult {
    degradation_score: number;
    condition: 'normal' | 'minor' | 'moderate' | 'severe';
    forecast_30d: number;
    confidence: number;
}

// --- Global Configuration ---
const BACKEND_API_IP: string = 'localhost'; //192.168.45.84
const BACKEND_PORT: number = 8000;
const DATA_FETCH_ENDPOINT: string = '/latest'; 
const RAW_DATA_FETCH_INTERVAL_MS: number = 500;
const PREDICTION_INTERVAL_MS: number = 5000;
const MAX_RETRIES: number = 5;
const MAX_POINTS: number = 50;

// --- Prediction Calculation Logic ---
const computePredictions = (data: MPUData): PredictionResult => {
    const { ax, ay, az, gx, gy, gz } = data;
    const accel_mag = Math.sqrt(ax * ax + ay * ay + az * az);
    const gyro_mag = Math.sqrt(gx * gx + gy * gy + gz * gz);

    const rawDegradation = (accel_mag * 0.8 + gyro_mag * 0.2) / 5.0;
    const degradation = Math.min(1.0, rawDegradation);

    let condition: 'normal' | 'minor' | 'moderate' | 'severe';
    if (degradation < 0.15) {
        condition = "normal";
    } else if (degradation < 0.3) {
        condition = "minor";
    } else if (degradation < 0.6) {
        condition = "moderate";
    } else {
        condition = "severe";
    }

    const forecast_30d = Math.min(1.0, degradation + 0.01 + Math.random() * 0.09);
    const confidence = 1.0 - Math.random() * 0.08;

    return {
        degradation_score: parseFloat(degradation.toFixed(3)),
        condition: condition,
        forecast_30d: parseFloat(forecast_30d.toFixed(3)),
        confidence: parseFloat(confidence.toFixed(3)),
    };
};

// --- Prediction Panel Component ---
// (No changes to the presentation logic here)
interface PredictionPanelProps {
    data: MPUData;
    prediction: PredictionResult;
}

const SensorPredictionPanel: FC<PredictionPanelProps> = ({ data, prediction }) => {
    const score = prediction.degradation_score * 100;
    const forecast = prediction.forecast_30d * 100;
    const confidencePct = prediction.confidence * 100;

    let statusTitle: string;
    let riskLevel: string;
    let statusColor: string;
    let detailMessage: string;

    switch (prediction.condition) {
        case 'normal':
            statusTitle = "NORMAL OPERATION";
            riskLevel = "Low";
            statusColor = "#22c55e";
            detailMessage = "System operating well within limits. Minimal vibration detected.";
            break;
        case 'minor':
            statusTitle = "MINOR VIBRATION";
            riskLevel = "Low-Medium";
            statusColor = "#3b82f6";
            detailMessage = "Slight acceleration and rotation fluctuations observed. Monitoring advised.";
            break;
        case 'moderate':
            statusTitle = "MODERATE STRESS";
            riskLevel = "Medium-High";
            statusColor = "#f59e0b";
            detailMessage = "Increased vibration suggests moderate stress. Forecast indicates potential degradation.";
            break;
        case 'severe':
            statusTitle = "SEVERE STRESS";
            riskLevel = "Critical";
            statusColor = "#ef4444";
            detailMessage = "Critical vibration levels detected. Immediate inspection is recommended.";
            break;
    }

    const meterPct = Math.round(score);

    return (
        <div style={{
            background: "#1e1e1e",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            border: `2px solid ${statusColor}aa`,
            minWidth: "350px",
            marginBottom: "20px"
        }}>
            <div style={{ color: "#22d3ee", fontWeight: "700", marginBottom: "8px", display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🌉</span> Bridge Health Status
            </div>

            <div style={{ fontSize: "28px", fontWeight: "800", marginBottom: "15px", color: statusColor }}>
                {statusTitle}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "14px" }}>
                {/* Score */}
                <div style={{ borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                    <div style={{ color: "#aaa" }}>Risk Level:</div>
                    <div style={{ fontWeight: "700", color: statusColor, fontSize: '16px' }}>{riskLevel}</div>
                </div>
                {/* Confidence */}
                <div style={{ borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                    <div style={{ color: "#aaa" }}>Confidence:</div>
                    <div style={{ fontWeight: "700", color: "#34d399", fontSize: '16px' }}>{confidencePct.toFixed(1)}%</div>
                </div>
                {/* Degradation Score */}
                <div style={{}}>
                    <div style={{ color: "#aaa" }}>Degradation Score:</div>
                    <div style={{ fontWeight: "700", color: "#f7dc6f", fontSize: '16px' }}>{score.toFixed(2)}</div>
                </div>
                {/* Forecast */}
                <div style={{}}>
                    <div style={{ color: "#aaa" }}>Forecast (Next 30d):</div>
                    <div style={{ fontWeight: "700", color: "#93c5fd", fontSize: '16px' }}>{forecast.toFixed(2)}</div>
                </div>
            </div>

            <p style={{ margin: "15px 0", fontSize: "13px", color: "#bbb", borderTop: '1px solid #333', paddingTop: '10px' }}>
                {detailMessage}
            </p>

            {/* Risk Meter */}
            <div style={{ fontSize: "12px", fontWeight: "700", marginBottom: "6px", color: "#22c55e" }}>Risk Meter ({meterPct}%)</div>
            <div style={{ height: "14px", width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "20px", overflow: "hidden" }}>
                <div style={{
                    width: `${meterPct}%`, height: "100%",
                    background: "linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)",
                    transition: "width 0.5s ease"
                }} />
            </div>
        </div>
    );
};


// --- Individual Graph Component ---
interface GraphProps {
    title: string;
    data: number[];
    color: string;
    unit: string;
    currentValue: number;
}

const SensorGraph: FC<GraphProps> = ({ title, data, color, unit, currentValue }) => {
    const displayData = data.length === 0 ? [currentValue] : data;
    const dataOnly = [...displayData];
    const absMax = Math.max(...dataOnly.map(Math.abs), 1);
    const range = absMax * 2 || 1; 
    const minValue = -absMax;
    
    return (
        <div style={{
            background: "#1e1e1e", 
            borderRadius: "6px",
            padding: "8px",
            border: `1px solid ${color}44`,
            display: "flex",
            flexDirection: "column",
            minHeight: "100px",
            marginBottom: "10px"
        }}>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "5px"
            }}>
                <h4 style={{ margin: 0, fontSize: "12px", color: color, fontWeight: "600" }}>
                    {title}
                </h4>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "white" }}>
                    {currentValue.toFixed(2)} {unit}
                </span>
            </div>
            
            <div style={{
                flex: 1,
                background: "#111", 
                borderRadius: "3px",
                position: "relative" as const,
                overflow: "hidden",
                minHeight: "50px"
            }}>
                <svg width="100%" height="100%" style={{ position: "absolute" }} viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Zero line */}
                    <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    
                    {/* Data line */}
                    {displayData.length > 0 && (
                        <polyline
                            points={displayData.map((value, index) => {
                                const x = (index / (MAX_POINTS - 1)) * 100;
                                const normalizedValue = (value - minValue) / range;
                                const y = 100 - (normalizedValue * 100);
                                return `${x},${y}`;
                            }).join(" ")}
                            fill="none"
                            stroke={color}
                            strokeWidth="1.5"
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                </svg>
            </div>
        </div>
    );
};

// --- MPU Data Fetching and Display Component ---

interface MPUDataDashboardProps {
    /** * Callback function to receive the current prediction status. 
     * Use this function in the parent component to synchronize data.
     */
    onPredictionUpdate?: (
        prediction: PredictionResult, 
        connection: 'connecting' | 'connected' | 'disconnected',
        error: string | null
    ) => void;
}

const MPUDataDashboard: FC<MPUDataDashboardProps> = ({ onPredictionUpdate }) => {
    const initialData: MPUData = {
        ax: 0, ay: 0, az: 0, 
        gx: 0, gy: 0, gz: 0, 
        temperature_c: 0,
        humidity_percent: 0
    };

    const [sensorData, setSensorData] = useState<MPUData>(initialData);
    const [predictionResult, setPredictionResult] = useState<PredictionResult>(computePredictions(initialData));

    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [error, setError] = useState<string | null>(null);
    const [retryAttempt, setRetryAttempt] = useState<number>(0); 

    // History states
    const [axHistory, setAxHistory] = useState<number[]>([]);
    const [ayHistory, setAyHistory] = useState<number[]>([]);
    const [azHistory, setAzHistory] = useState<number[]>([]);
    const [gxHistory, setGxHistory] = useState<number[]>([]);
    const [gyHistory, setGyHistory] = useState<number[]>([]);
    const [gzHistory, setGzHistory] = useState<number[]>([]);
    const [tempHistory, setTempHistory] = useState<number[]>([]);
    const [humidityHistory, setHumidityHistory] = useState<number[]>([]);

    const updateHistory = (data: MPUData) => {
        setAxHistory(prev => [...prev, data.ax].slice(-MAX_POINTS));
        setAyHistory(prev => [...prev, data.ay].slice(-MAX_POINTS));
        setAzHistory(prev => [...prev, data.az].slice(-MAX_POINTS));
        setGxHistory(prev => [...prev, data.gx].slice(-MAX_POINTS));
        setGyHistory(prev => [...prev, data.gy].slice(-MAX_POINTS));
        setGzHistory(prev => [...prev, data.gz].slice(-MAX_POINTS));
        setTempHistory(prev => [...prev, data.temperature_c].slice(-MAX_POINTS));
        setHumidityHistory(prev => [...prev, data.humidity_percent].slice(-MAX_POINTS));
    };

    /**
     * Fetches raw sensor data.
     */
    const fetchMpuData = async () => {
        const url = `http://${BACKEND_API_IP}:${BACKEND_PORT}${DATA_FETCH_ENDPOINT}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            setRetryAttempt(0); 
            const data: MPUData = await response.json(); 
            
            setSensorData(data);
            updateHistory(data);
            setConnectionStatus('connected');
            setError(null);
            
        } catch (err: unknown) {
            const nextRetryAttempt = retryAttempt + 1;
            setRetryAttempt(nextRetryAttempt);

            if (nextRetryAttempt >= MAX_RETRIES) {
                setError(`Connection failed after ${MAX_RETRIES} attempts. Check API: ${BACKEND_API_IP}:${BACKEND_PORT}`);
                setConnectionStatus('disconnected');
                return; 
            }

            const delay = Math.pow(2, nextRetryAttempt) * 1000;
            setError(`Connection lost. Retrying in ${delay / 1000}s...`);
            setConnectionStatus('connecting');
        }
    };

    // --- EFFECT 1: Raw Data Polling (Fast - 500ms) ---
    useEffect(() => {
        if (connectionStatus === 'disconnected' && retryAttempt >= MAX_RETRIES) return;
        
        const intervalId = setInterval(() => {
            fetchMpuData();
        }, RAW_DATA_FETCH_INTERVAL_MS);
        
        fetchMpuData(); // Initial fetch
        
        return () => {
            clearInterval(intervalId);
        };
    }, [retryAttempt, connectionStatus]); 
    
    // --- EFFECT 2: Prediction Update (Slow - 5000ms) ---
    useEffect(() => {
        if (connectionStatus === 'connected') {
            const predictionInterval = setInterval(() => {
                // Only run the computePredictions logic on this slower interval
                setPredictionResult(computePredictions(sensorData));
            }, PREDICTION_INTERVAL_MS);

            // Initial calculation
            setPredictionResult(computePredictions(sensorData));

            return () => {
                clearInterval(predictionInterval);
            };
        }
    }, [connectionStatus, sensorData]);

    // --- EFFECT 3: Report status to parent component ---
    const reportStatus = useCallback(() => {
        if (onPredictionUpdate) {
            onPredictionUpdate(predictionResult, connectionStatus, error);
        }
    }, [onPredictionUpdate, predictionResult, connectionStatus, error]);

    useEffect(() => {
        reportStatus();
    }, [reportStatus]);


    // Dynamic style based on status
    const statusColor: string = connectionStatus === 'connected' ? '#27ae60' : connectionStatus === 'connecting' ? '#f39c12' : '#e74c3c';

    return (
        <div style={{
            // Main container for the entire dashboard
            background: "#0f1a30", 
            color: "white",
            padding: "20px",
            minHeight: "100vh",
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        }}>
            {/* Main Header and Status Bar */}
            <div style={{ 
                marginBottom: "25px", 
                textAlign: "center",
                background: "#1c2a4a",
                padding: "15px",
                borderRadius: "10px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                borderBottom: `3px solid ${statusColor}`
            }}>
                <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>
                    Sensor Data & Health Prediction
                </h1>
                <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: statusColor, fontWeight: "500" }}>
                    {error || (connectionStatus === 'connected' ? `Connected | Fetching from Backend API @ ${BACKEND_API_IP}:${BACKEND_PORT}` : 'Attempting to connect...')}
                </p>
            </div>

            {/* Layout: Prediction Panel (Left) and Graphs (Right) */}
            <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "20px",
                justifyContent: "center",
            }}>
                {/* 1. Prediction Panel (Left Side) */}
                <div style={{ flex: '1 1 350px', maxWidth: '400px' }}>
                    <SensorPredictionPanel data={sensorData} prediction={predictionResult} />
                </div>
                
                {/* 2. Sensor Graphs (Right Side) */}
                <div style={{ flex: '2 1 500px', maxWidth: '900px' }}>
                    <h2 style={{ fontSize: "18px", color: "#ddd", marginBottom: "15px", fontWeight: 300, borderBottom: '1px solid #333', paddingBottom: '5px' }}>
                        Live Sensor Data History
                    </h2>
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "10px",
                    }}>
                        <SensorGraph
                            title="Accel X (ax)" data={axHistory} color="#FF6B6B" unit="g" currentValue={sensorData.ax}
                        />
                        <SensorGraph
                            title="Accel Y (ay)" data={ayHistory} color="#4ECDC4" unit="g" currentValue={sensorData.ay}
                        />
                        <SensorGraph
                            title="Accel Z (az)" data={azHistory} color="#45B7D1" unit="g" currentValue={sensorData.az}
                        />
                        <SensorGraph
                            title="Gyro X (gx)" data={gxHistory} color="#FFA07A" unit="°/s" currentValue={sensorData.gx}
                        />
                        <SensorGraph
                            title="Gyro Y (gy)" data={gyHistory} color="#98D8C8" unit="°/s" currentValue={sensorData.gy}
                        />
                        <SensorGraph
                            title="Gyro Z (gz)" data={gzHistory} color="#F7DC6F" unit="°/s" currentValue={sensorData.gz}
                        />
                        <SensorGraph
                            title="Temperature (t)" data={tempHistory} color="#93c5fd" unit="°C" currentValue={sensorData.temperature_c}
                        />
                         <SensorGraph
                            title="Humidity (h)" data={humidityHistory} color="#34D399" unit="%" currentValue={sensorData.humidity_percent}
                        />
                    </div>
                </div>
            </div>
            
            {/* Device ID and Final Status Footer */}
            <div style={{
                background: "#1c2a4a",
                padding: "10px 20px",
                borderRadius: "8px",
                marginTop: "25px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 0 10px rgba(0,0,0,0.3)",
                margin: '25px auto 0',
                maxWidth: '90%'
            }}>
                <span style={{ fontSize: "13px", color: "#93c5fd" }}>Device Identifier</span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#F7DC6F" }}>
                    {sensorData.device_id || 'esp32-bridge-1 (default)'}
                </span>
            </div>
        </div>
    );
};

export default MPUDataDashboard;