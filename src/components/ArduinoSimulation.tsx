import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from 'react-router-dom';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Define the sensor data type matching Arduino JSON format
interface ArduinoSensorData {
  infrastructure_id: string;
  location: string;
  timestamp: number;
  status: 'normal' | 'warning' | 'critical';
  sensors: {
    strain: number;
    vibration: number;
    temperature: number;
    accelerometer: {
      x: number;
      y: number;
      z: number;
    };
    gyroscope?: {
      x: number;
      y: number;
      z: number;
    };
  };
  system: {
    uptime: number;
    free_memory: number;
    battery_level: number;
  };
}

// Simple fallback bridge component using basic geometries
function FallbackBridge({ sensorData, overrideColor }: { sensorData: ArduinoSensorData; overrideColor?: string }) {
  const { user, userRole, signOut, loading } = useAuth();
  const groupRef = useRef<THREE.Group>(null!);

  // Animation disabled - bridge is static

  if (!user) {
      return <Navigate to="/auth" replace />;
    }
  // Determine color from FastAPI override first, then strain fallback
  const getColor = (): string => {
    if (overrideColor) return overrideColor;
    if (sensorData.sensors.strain < 1000) return "#00ff00"; // Green
    if (sensorData.sensors.strain < 2000) return "#ffff00"; // Yellow
    return "#ff0000"; // Red
  };

  return (
    <group ref={groupRef}>
      {/* Bridge deck */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[6, 0.3, 1.5]} />
        <meshStandardMaterial color={getColor()} />
      </mesh>
      
      {/* Bridge supports */}
      <mesh position={[-2.5, -1.5, 0]}>
        <boxGeometry args={[0.3, 3, 0.3]} />
        <meshStandardMaterial color="#666666" />
      </mesh>
      <mesh position={[2.5, -1.5, 0]}>
        <boxGeometry args={[0.3, 3, 0.3]} />
        <meshStandardMaterial color="#666666" />
      </mesh>
      
      {/* Bridge cables */}
      {[-1.5, -0.5, 0.5, 1.5].map((x, i) => (
        <mesh key={i} position={[x, 0.8, 0]} rotation={[0, 0, x * 0.1]}>
          <cylinderGeometry args={[0.01, 0.01, 1.6]} />
          <meshStandardMaterial color="#444444" />
        </mesh>
      ))}
      
      {/* Base platform */}
      <mesh position={[0, -3.2, 0]}>
        <boxGeometry args={[8, 0.4, 2]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
    </group>
  );
}

// CAD Model Bridge Component
function CADModelBridge({ sensorData, overrideColor }: { sensorData: ArduinoSensorData; overrideColor?: string }) {
  const groupRef = useRef<THREE.Group>(null!);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Load the GLB model
  let gltf;
  try {
    gltf = useGLTF("/bridge.glb");
  } catch (err) {
    console.error("Error loading GLB model:", err);
  }

  // Clone the scene to avoid modifying the original
  const [clonedScene, setClonedScene] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    if (gltf?.scene) {
      try {
        const cloned = gltf.scene.clone();
        setClonedScene(cloned);
        setModelLoaded(true);
        console.log("CAD model loaded successfully");
      } catch (err) {
        console.error("Error cloning model:", err);
        setError("Failed to process CAD model");
      }
    }
  }, [gltf]);

  // Animation disabled - bridge is static

  // Update material colors based on strain
  useEffect(() => {
    if (!clonedScene) return;

    let color: THREE.Color;
    if (overrideColor) {
      color = new THREE.Color(overrideColor);
    } else if (sensorData.sensors.strain < 1000) {
      color = new THREE.Color(0x00ff00); // Green
    } else if (sensorData.sensors.strain < 2000) {
      color = new THREE.Color(0xffff00); // Yellow
    } else {
      color = new THREE.Color(0xff0000); // Red
    }

    clonedScene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        // Handle both single materials and material arrays
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach((material: any) => {
          if (material.emissive) {
            material.emissive.copy(color);
            material.emissiveIntensity = 0.1;
          }
          // Also tint the main color slightly
          if (material.color) {
            const originalColor = material.userData.originalColor || material.color.clone();
            if (!material.userData.originalColor) {
              material.userData.originalColor = originalColor.clone();
            }
            material.color.copy(originalColor).lerp(color, 0.2);
          }
        });
      }
    });
  }, [sensorData.sensors.strain, clonedScene, overrideColor]);

  // Show fallback if model failed to load
  if (error || !gltf || !clonedScene) {
    return <FallbackBridge sensorData={sensorData} />;
  }

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={0.1} position={[0, -2, 0]} />
    </group>
  );
}

// Model Loader with error boundaries
function ModelWithFallback({ sensorData, overrideColor }: { sensorData: ArduinoSensorData; overrideColor?: string }) {
  const [useCAD, setUseCAD] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const handleError = () => {
    console.log("Switching to fallback bridge due to model loading error");
    setLoadError(true);
    setUseCAD(false);
  };

  if (loadError || !useCAD) {
    return <FallbackBridge sensorData={sensorData} overrideColor={overrideColor} />;
  }

  return (
    <Suspense fallback={<FallbackBridge sensorData={sensorData} />}>
      <ErrorBoundary onError={handleError}>
        <CADModelBridge sensorData={sensorData} overrideColor={overrideColor} />
      </ErrorBoundary>
    </Suspense>
  );
}

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Model loading error:", error, errorInfo);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null; // Will show fallback
    }

    return this.props.children;
  }
}

// Loading component
function LoadingSpinner() {
  return (
    <div style={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      color: "white",
      fontSize: "18px",
      textAlign: "center" as const
    }}>
      <div style={{
        width: "40px",
        height: "40px",
        border: "4px solid rgba(255,255,255,0.3)",
        borderTop: "4px solid white",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
        margin: "0 auto 10px"
      }} />
      Loading Real Sensor Data...
    </div>
  );
}

// Individual Graph Component
interface GraphProps {
  title: string;
  data: number[];
  color: string;
  unit: string;
  currentValue: number;
}

function SensorGraph({ title, data, color, unit, currentValue }: GraphProps) {
  // Ensure we have at least 2 data points for proper rendering
  const displayData = data.length < 2 ? [...data, currentValue] : data;
  const maxValue = Math.max(...displayData, Math.abs(Math.min(...displayData)), 1);
  const minValue = Math.min(...displayData, -maxValue);
  const range = maxValue - minValue || 1;
  
  return (
    <div style={{
      background: "rgba(0, 0, 0, 0.6)",
      backdropFilter: "blur(10px)",
      borderRadius: "6px",
      padding: "8px",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      display: "flex",
      flexDirection: "column" as const,
      height: "100%"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "6px"
      }}>
        <h4 style={{ margin: 0, fontSize: "11px", color: color, fontWeight: "600" }}>
          {title}
        </h4>
        <span style={{ fontSize: "11px", fontWeight: "bold", color: "white" }}>
          {currentValue.toFixed(2)} {unit}
        </span>
      </div>
      <div style={{
        flex: 1,
        background: "rgba(255, 255, 255, 0.05)",
        borderRadius: "4px",
        position: "relative" as const,
        overflow: "hidden",
        minHeight: "60px"
      }}>
        <svg width="100%" height="100%" style={{ position: "absolute" as const }} viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          
          {/* Data line */}
          {displayData.length > 0 && (
            <polyline
              points={displayData.map((value, index) => {
                const x = displayData.length === 1 ? 50 : (index / (displayData.length - 1)) * 100;
                const normalizedValue = ((value - minValue) / range);
                const y = 100 - (normalizedValue * 100);
                return `${x},${y}`;
              }).join(" ")}
              fill="none"
              stroke={color}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

// Main Arduino Simulation Component
const ArduinoSimulation: React.FC = () => {
  const [sensorData, setSensorData] = useState<ArduinoSensorData>({
    infrastructure_id: "BRIDGE_001",
    location: "Connecting to Node...",
    timestamp: Date.now(),
    status: "normal",
    sensors: {
      strain: 236,
      vibration: 122,
      temperature: 32,
      accelerometer: { x: 0, y: 0, z: 0 },
      gyroscope: { x: 0, y: 0, z: 0 }
    },
    system: {
      uptime: 0,
      free_memory: 1500,
      battery_level: 95
    }
  });

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [dataHistory, setDataHistory] = useState<ArduinoSensorData[]>([]);
  const [bridgeColor, setBridgeColor] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [useSimulation, setUseSimulation] = useState(false);
  const [arduinoIP, setArduinoIP] = useState<string>('');
  const [useArduino, setUseArduino] = useState(false);
  
  // Graph data history (keep last 50 points)
  const [accelXHistory, setAccelXHistory] = useState<number[]>([]);
  const [accelYHistory, setAccelYHistory] = useState<number[]>([]);
  const [accelZHistory, setAccelZHistory] = useState<number[]>([]);
  const [gyroXHistory, setGyroXHistory] = useState<number[]>([]);
  const [gyroYHistory, setGyroYHistory] = useState<number[]>([]);
  const [gyroZHistory, setGyroZHistory] = useState<number[]>([]);

  // WebSocket connection to backend
  const initWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.onopen = () => {
        console.log('Connected to Arduino data stream');
        setConnectionStatus('connected');
        setError(null);
        
        // Clear polling fallback
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: ArduinoSensorData = JSON.parse(event.data);
          setSensorData(data);
          
          // Add to history (keep last 50 readings)
          setDataHistory(prev => {
            const newHistory = [...prev, data].slice(-50);
            return newHistory;
          });
          
          // Update graph histories
          const maxPoints = 50;
          setAccelXHistory(prev => [...prev, data.sensors.accelerometer.x].slice(-maxPoints));
          setAccelYHistory(prev => [...prev, data.sensors.accelerometer.y].slice(-maxPoints));
          setAccelZHistory(prev => [...prev, data.sensors.accelerometer.z].slice(-maxPoints));
          setGyroXHistory(prev => [...prev, data.sensors.gyroscope?.x || 0].slice(-maxPoints));
          setGyroYHistory(prev => [...prev, data.sensors.gyroscope?.y || 0].slice(-maxPoints));
          setGyroZHistory(prev => [...prev, data.sensors.gyroscope?.z || 0].slice(-maxPoints));
          
          console.log('📊 Arduino Data:', {
            strain: data.sensors.strain,
            vibration: data.sensors.vibration,
            temperature: data.sensors.temperature,
            status: data.status
          });
          
        } catch (err) {
          console.error('Error parsing WebSocket data:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected - attempting to reconnect...');
        setConnectionStatus('disconnected');
        
        // Start polling fallback
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(fetchData, 5000);
        }
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            initWebSocket();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
        
        // Start polling fallback
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(fetchData, 5000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setError('Failed to connect to sensor data stream');
      setConnectionStatus('disconnected');
      
      // Start polling fallback
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(fetchData, 5000);
      }
    }
  };

  // Fetch data from ESP32 Arduino
  const fetchArduinoData = async () => {
    if (!arduinoIP) return;
    
    try {
      const response = await fetch(`http://${arduinoIP}`);
      if (response.ok) {
        const espData = await response.json();
        
        // Map ESP32 data format to our interface
        const mappedData: ArduinoSensorData = {
          infrastructure_id: "ESP32_MPU6050",
          location: `Arduino @ ${arduinoIP}`,
          timestamp: Date.now(),
          status: 'normal',
          sensors: {
            strain: Math.abs(espData.ax * 100), // Derive strain from acceleration
            vibration: Math.sqrt(espData.gx**2 + espData.gy**2 + espData.gz**2), // Magnitude of gyro
            temperature: 25, // Not available from MPU6050
            accelerometer: {
              x: espData.ax || 0,
              y: espData.ay || 0,
              z: espData.az || 0
            },
            gyroscope: {
              x: espData.gx || 0,
              y: espData.gy || 0,
              z: espData.gz || 0
            }
          },
          system: {
            uptime: Math.floor(Date.now() / 1000),
            free_memory: 0,
            battery_level: 100
          }
        };
        
        setSensorData(mappedData);
        setConnectionStatus('connected');
        setError(null);
        
        // Update graph histories
        const maxPoints = 50;
        setAccelXHistory(prev => [...prev, mappedData.sensors.accelerometer.x].slice(-maxPoints));
        setAccelYHistory(prev => [...prev, mappedData.sensors.accelerometer.y].slice(-maxPoints));
        setAccelZHistory(prev => [...prev, mappedData.sensors.accelerometer.z].slice(-maxPoints));
        setGyroXHistory(prev => [...prev, mappedData.sensors.gyroscope?.x || 0].slice(-maxPoints));
        setGyroYHistory(prev => [...prev, mappedData.sensors.gyroscope?.y || 0].slice(-maxPoints));
        setGyroZHistory(prev => [...prev, mappedData.sensors.gyroscope?.z || 0].slice(-maxPoints));
        
        setDataHistory(prev => [...prev, mappedData].slice(-50));
        
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('Error fetching Arduino data:', err);
      setError(`Unable to connect to Arduino at ${arduinoIP}`);
      setConnectionStatus('disconnected');
    }
  };

  // Polling fallback for when WebSocket fails
  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/sensor-data');
      if (response.ok) {
        const data: ArduinoSensorData = await response.json();
        setSensorData(data);
        setConnectionStatus('connected');
        setError(null);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('Error fetching sensor data:', err);
      setError('Unable to fetch sensor data');
      setConnectionStatus('disconnected');
    }
  };

  // Generate random sensor data for simulation
  const generateRandomSensorData = (): ArduinoSensorData => {
    const baseAccel = {
      x: Math.sin(Date.now() / 1000) * 2 + (Math.random() - 0.5) * 0.5,
      y: Math.cos(Date.now() / 1000) * 1.5 + (Math.random() - 0.5) * 0.3,
      z: 9.8 + (Math.random() - 0.5) * 0.2
    };

    const baseGyro = {
      x: Math.sin(Date.now() / 2000) * 15 + (Math.random() - 0.5) * 5,
      y: Math.cos(Date.now() / 2000) * 12 + (Math.random() - 0.5) * 4,
      z: Math.sin(Date.now() / 3000) * 8 + (Math.random() - 0.5) * 3
    };

    const strain = 200 + Math.sin(Date.now() / 5000) * 800 + Math.random() * 100;
    const vibration = 100 + Math.sin(Date.now() / 3000) * 50 + Math.random() * 20;
    const temperature = 28 + Math.sin(Date.now() / 10000) * 5 + Math.random() * 2;

    return {
      infrastructure_id: "BRIDGE_001",
      location: "Test Bridge (Simulated Data)",
      timestamp: Date.now(),
      status: strain > 800 ? 'warning' : strain > 1000 ? 'critical' : 'normal',
      sensors: {
        strain,
        vibration,
        temperature,
        accelerometer: baseAccel,
        gyroscope: baseGyro
      },
      system: {
        uptime: Math.floor(Date.now() / 1000),
        free_memory: 1500 + Math.floor(Math.random() * 100),
        battery_level: 85 + Math.floor(Math.random() * 15)
      }
    };
  };

  // Start simulation mode
  const startSimulation = () => {
    console.log('🎮 Starting simulation mode with random data');
    setUseSimulation(true);
    setConnectionStatus('connected');
    setError(null);

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
    }

    const initialData = generateRandomSensorData();
    setSensorData(initialData);

    simulationIntervalRef.current = setInterval(() => {
      const data = generateRandomSensorData();
      setSensorData(data);
      
      const maxPoints = 50;
      setAccelXHistory(prev => [...prev, data.sensors.accelerometer.x].slice(-maxPoints));
      setAccelYHistory(prev => [...prev, data.sensors.accelerometer.y].slice(-maxPoints));
      setAccelZHistory(prev => [...prev, data.sensors.accelerometer.z].slice(-maxPoints));
      setGyroXHistory(prev => [...prev, data.sensors.gyroscope?.x || 0].slice(-maxPoints));
      setGyroYHistory(prev => [...prev, data.sensors.gyroscope?.y || 0].slice(-maxPoints));
      setGyroZHistory(prev => [...prev, data.sensors.gyroscope?.z || 0].slice(-maxPoints));
      
      setDataHistory(prev => [...prev, data].slice(-50));
    }, 100);
  };

  // Stop simulation mode
  const stopSimulation = () => {
    console.log('⏹️ Stopping simulation mode');
    setUseSimulation(false);
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    initWebSocket();
  };

  // Start Arduino connection
  const startArduinoConnection = (ip: string) => {
    console.log('🔌 Connecting to Arduino at', ip);
    setArduinoIP(ip);
    setUseArduino(true);
    setUseSimulation(false);
    setConnectionStatus('connecting');
    setError(null);
    
    // Clear other intervals
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Function to fetch with the IP (try both endpoints)
    const fetchWithIP = async () => {
      try {
        // Try root endpoint first, then /data endpoint
        console.log(`🔄 Fetching data from http://${ip}`);
        let response = await fetch(`http://${ip}`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        console.log('Response status:', response.status);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          // Root returns HTML, try /data endpoint instead
          console.log('🔄 Root endpoint returned HTML, trying /data...');
          response = await fetch(`http://${ip}/data`, {
            method: 'GET',
            mode: 'cors',
            headers: {
              'Accept': 'application/json',
            },
          });
        }
        
        if (response.ok) {
          const espData = await response.json();
          console.log('✅ Received Arduino data:', espData);
          
          const mappedData: ArduinoSensorData = {
            infrastructure_id: "ESP32_MPU6050",
            location: `Arduino @ ${ip}`,
            timestamp: Date.now(),
            status: 'normal',
            sensors: {
              strain: Math.abs(espData.ax * 100),
              vibration: Math.sqrt(espData.gx**2 + espData.gy**2 + espData.gz**2),
              temperature: 25,
              accelerometer: {
                x: espData.ax || 0,
                y: espData.ay || 0,
                z: espData.az || 0
              },
              gyroscope: {
                x: espData.gx || 0,
                y: espData.gy || 0,
                z: espData.gz || 0
              }
            },
            system: {
              uptime: Math.floor(Date.now() / 1000),
              free_memory: 0,
              battery_level: 100
            }
          };
          
          setSensorData(mappedData);
          setConnectionStatus('connected');
          setError(null);
          
          const maxPoints = 50;
          setAccelXHistory(prev => [...prev, mappedData.sensors.accelerometer.x].slice(-maxPoints));
          setAccelYHistory(prev => [...prev, mappedData.sensors.accelerometer.y].slice(-maxPoints));
          setAccelZHistory(prev => [...prev, mappedData.sensors.accelerometer.z].slice(-maxPoints));
          setGyroXHistory(prev => [...prev, mappedData.sensors.gyroscope?.x || 0].slice(-maxPoints));
          setGyroYHistory(prev => [...prev, mappedData.sensors.gyroscope?.y || 0].slice(-maxPoints));
          setGyroZHistory(prev => [...prev, mappedData.sensors.gyroscope?.z || 0].slice(-maxPoints));
          setDataHistory(prev => [...prev, mappedData].slice(-50));
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err: any) {
        console.error('❌ Error fetching Arduino data:', err);
        const errorMsg = err.message || 'Network error';
        setError(`Cannot connect to ${ip}: ${errorMsg}`);
        setConnectionStatus('disconnected');
      }
    };
    
    // Start polling Arduino every 200ms
    pollingIntervalRef.current = setInterval(fetchWithIP, 200);
    
    // Initial fetch
    fetchWithIP();
  };

  // Stop Arduino connection
  const stopArduinoConnection = () => {
    console.log('⏹️ Stopping Arduino connection');
    setUseArduino(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setConnectionStatus('disconnected');
  };

  // Arduino control functions
  const sendArduinoCommand = async (command: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/arduino/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      const result = await response.json();
      console.log('Arduino command result:', result);
      return result.success;
    } catch (error) {
      console.error('Error sending Arduino command:', error);
      return false;
    }
  };

  const calibrateStrainGauge = async () => {
    const success = await sendArduinoCommand('TARE');
    if (success) {
      alert('Strain gauge calibrated successfully!');
    } else {
      alert('Failed to calibrate strain gauge. Check Arduino connection.');
    }
  };

  // Initialize connection
  useEffect(() => {
    // Auto-start simulation mode for testing
    setTimeout(() => {
      if (connectionStatus !== 'connected') {
        startSimulation();
      }
    }, 2000);
    
    initWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  // Poll FastAPI to determine bridge color (green/yellow/red)
  useEffect(() => {
    let t: NodeJS.Timeout;
    const fetchHealth = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/predict');
        const data = await res.json();
        const label: string = (data.condition_label || '').toUpperCase();
        const risk: string = (data.risk_level || '').toUpperCase();
        let color = '#ffff00';
        if (label.includes('NORMAL') || risk === 'LOW') color = '#00ff00';
        else if (label.includes('CRITICAL') || risk === 'HIGH') color = '#ff0000';
        else color = '#ffff00'; // medium
        setBridgeColor(color);
      } catch (e) {
        // keep last color on failure
      }
    };
    fetchHealth();
    t = setInterval(fetchHealth, 1800);
    return () => clearInterval(t);
  }, []);

  // Get status info
  const getStatusInfo = () => {
    const status = sensorData.status;
    if (status === "normal") return { text: "✅ Normal", color: "#00ff00" };
    if (status === "warning") return { text: "⚠️ Warning", color: "#ffff00" };
    return { text: "🚨 Critical", color: "#ff0000" };
  };

  const statusInfo = getStatusInfo();

  return (
    <div style={{
      width: "100%",
      height: "100vh",
      background: "linear-gradient(135deg, #0f04f, #1a1a2f)",
      display: "flex",
      flexDirection: "row" as const,
      position: "relative" as const,
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      overflow: "hidden"
    }}>
      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Connection Status with Simulation Toggle */}
      <div style={{
        position: "absolute" as const,
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: useArduino ? "rgba(59, 130, 246, 0.4)" :
                   useSimulation ? "rgba(15, 51, 234, 0.4)" :
                   connectionStatus === 'connected' ? "rgba(34, 197, 94, 0.4)" : 
                   connectionStatus === 'connecting' ? "rgba(245, 158, 11, 0.4)" : "rgba(239, 68, 68, 0.9)",
        color: "white",
        padding: "10px 20px",
        borderRadius: "8px",
        fontSize: "13px",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
      }}>
        <span style={{ fontWeight: "500" }}>
          {useArduino ? ` Arduino: ${arduinoIP}` :
           useSimulation ? ' Simulation Mode' :
           connectionStatus === 'connected' ? '🔗 Connected' :
           connectionStatus === 'connecting' ? '🔗 Connecting...' : '🔗 Disconnected'}
        </span>
        {useSimulation && (
          <button
            onClick={stopSimulation}
            style={{
              background: "rgba(255, 255, 255, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              color: "white",
              padding: "5px 12px",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500"
            }}
          >
            Stop
          </button>
        )}
        {useArduino && (
          <button
            onClick={stopArduinoConnection}
            style={{
              background: "rgba(255, 255, 255, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              color: "white",
              padding: "5px 12px",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500"
            }}
          >
            Disconnect
          </button>
        )}
        {!useSimulation && !useArduino && connectionStatus !== 'connected' && (
          <button
            onClick={startSimulation}
            style={{
              background: "rgba(147, 51, 234, 0.9)",
              border: "1px solid rgba(147, 51, 234, 1)",
              color: "white",
              padding: "5px 12px",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500"
            }}
          >
            Simulate
          </button>
        )}
      </div>

      {/* Arduino IP Input */}
      {!useArduino && !useSimulation && (
        <div style={{
          position: "absolute" as const,
          top: "70px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(10px)",
          color: "white",
          padding: "12px 20px",
          borderRadius: "8px",
          fontSize: "13px",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.1)"
        }}>
          <span style={{ fontSize: "12px", color: "#aaa" }}>Arduino IP:</span>
          <input
            type="text"
            placeholder="192.168.x.x"
            value={arduinoIP}
            onChange={(e) => setArduinoIP(e.target.value)}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "white",
              padding: "5px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              width: "130px",
              outline: "none"
            }}
          />
          <button
            onClick={async () => {
              if (!arduinoIP) return;
              // Test connection first
              try {
                const response = await fetch(`http://${arduinoIP}`);
                const data = await response.json();
                console.log('✅ Test successful! Data:', data);
                alert(`✅ Connection successful!\n\nReceived data:\nax: ${data.ax}\nay: ${data.ay}\naz: ${data.az}\ngx: ${data.gx}\ngy: ${data.gy}\ngz: ${data.gz}`);
              } catch (err: any) {
                console.error('❌ Test failed:', err);
                alert(`❌ Connection failed!\n\nError: ${err.message}\n\nCheck browser console (F12) for details.`);
              }
            }}
            disabled={!arduinoIP}
            style={{
              background: arduinoIP ? "rgba(34, 197, 94, 0.9)" : "rgba(100, 100, 100, 0.5)",
              border: "1px solid rgba(34, 197, 94, 1)",
              color: "white",
              padding: "5px 12px",
              borderRadius: "5px",
              cursor: arduinoIP ? "pointer" : "not-allowed",
              fontSize: "12px",
              fontWeight: "500",
              marginRight: "5px"
            }}
          >
            Test
          </button>
          <button
            onClick={() => arduinoIP && startArduinoConnection(arduinoIP)}
            disabled={!arduinoIP}
            style={{
              background: arduinoIP ? "rgba(59, 130, 246, 0.9)" : "rgba(100, 100, 100, 0.5)",
              border: "1px solid rgba(59, 130, 246, 1)",
              color: "white",
              padding: "5px 15px",
              borderRadius: "5px",
              cursor: arduinoIP ? "pointer" : "not-allowed",
              fontSize: "12px",
              fontWeight: "500"
            }}
          >
            Connect
          </button>
        </div>
      )}

      {/*{/* Error Display 
      {error && (
        <div style={{
          position: "absolute" as const,
          top: "130px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(239, 68, 68, 0.95)",
          color: "white",
          padding: "12px 20px",
          borderRadius: "8px",
          zIndex: 1000,
          maxWidth: "500px",
          fontSize: "12px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.2)"
        }}>
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>⚠️ Connection Error</div>
          <div>{error}</div>
          <div style={{ marginTop: "8px", fontSize: "11px", opacity: 0.8 }}>
            💡 Troubleshooting:
            <br />• Check Arduino IP address (open http://{arduinoIP || '192.168.1.105'}/data in a new tab)
            <br />• Both devices must be on same Wi-Fi network
            <br />• Upload the arduino_with_cors.ino code to enable cross-origin requests
            <br />• Check browser console (F12) for detailed errors
          </div>
        </div>
      )}*/}

      {/* Arduino Controls */}
      {/* <div style={{
        position: "absolute" as const,
        top: "20px",
        right: "20px",
        zIndex: 1000,
        display: "flex",
        gap: "10px",
        flexWrap: "wrap" as const
      }}> */}
        {/* <button
          onClick={calibrateStrainGauge}
          style={{
            background: "#8B5CF6",
            color: "white",
            border: "none",
            padding: "8px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          📏 Calibrate
        </button>
        <button
          onClick={() => sendArduinoCommand('STATUS')}
          style={{
            background: "#06B6D4",
            color: "white",
            border: "none",
            padding: "8px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          📊 Status
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "#F59E0B",
            color: "white",
            border: "none",
            padding: "8px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          🔄 Refresh
        </button>
      </div> */}

      {/* Left Side: 3D Bridge Visualization - 70% */}
      <div style={{ width: "75%", height: "100%", position: "relative" as const, borderRight: "1px solid rgba(255,255,255,0.1)" }}>
        <Suspense fallback={<LoadingSpinner />}>
          <Canvas 
            camera={{ position: [10, 6, 10], fov: 50 }}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <directionalLight position={[-10, -10, -5]} intensity={0.3} />
            <pointLight position={[0, 5, 0]} intensity={0.5} color="#ffffff" />
            
            <OrbitControls 
              enablePan={true} 
              enableZoom={true} 
              enableRotate={true}
              maxPolarAngle={Math.PI / 1.8}
              minDistance={3}
              maxDistance={25}
            />
            
            <ModelWithFallback sensorData={sensorData} overrideColor={bridgeColor ?? undefined} />
            
            {/* No ground plane or grid - completely removed */}
          </Canvas>
        </Suspense>

      

        {/* Data History Chart */}
        {/* {dataHistory.length > 5 && (
          <div style={{
            position: "absolute" as const,
            bottom: 20,
            right: 20,
            padding: "15px 20px",
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(10px)",
            borderRadius: "12px",
            color: "white",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            width: "300px"
          }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#2196F3" }}>
              Live Data History
            </h4>
            <div style={{
              height: "60px",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "4px",
              position: "relative",
              overflow: "hidden"
            }}>
              <svg width="100%" height="100%" style={{ position: "absolute" }}>
                <polyline
                  points={dataHistory.slice(-20).map((data, index) => 
                    `${(index / 19) * 100},${100 - (data.sensors.strain / 3000) * 100}`
                  ).join(" ")}
                  fill="none"
                  stroke={statusInfo.color}
                  strokeWidth="2"
                />
              </svg>
            </div>
            <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#aaa" }}>
              Last 20 readings • Real-time updates
            </p>
          </div>
        )} */}

        {/* Title */}
        <div style={{
          position: "absolute" as const,
          top: 20,
          left: 20,
          color: "white",
          zIndex: 100
        }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "300", letterSpacing: "1px" }}>
             BIM Simulation
          </h1>
          <p style={{ margin: "5px 0 0 0", fontSize: "14px", color: "#aaa" }}>
            Real-time data from integrated sensors
          </p>
        </div>
      </div>

      {/* Right Side: Bridge Health Dashboard (FastAPI) */}
      <div style={{
        width: "25%",
        height: "100%",
        padding: "16px",
        overflowY: "auto" as const,
        display: "flex",
        flexDirection: "column" as const,
        gap: "14px"
      }}>
        <BridgeHealthFromFastAPI />
      </div>
    </div>
  );
};

// Preload the GLTF model
useGLTF.preload("/bridge.glb");

// --- Bridge Health Panel (uses FastAPI /stats) ---
interface BridgeApiHealth {
  status: string;
  model: string;
}
interface BridgeApiStats {
  total_predictions: number;
  health_state_counts: Record<string, number>;
  avg_confidence: number; // 0..1
  avg_risk: number;       // 0..1
}

function BridgeHealthPanel() {
  const [stats, setStats] = useState<BridgeApiStats | null>(null);
  const [health, setHealth] = useState<BridgeApiHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fetchStats = async () => {
      try {
        const h = await fetch("http://localhost:8000/health");
        if (!h.ok) throw new Error("FastAPI not healthy");
        setHealth(await h.json());
        const res = await fetch("http://localhost:8000/stats");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStats(data);
        setError(null);
      } catch (e: any) {
        setError(e.message || "Cannot reach FastAPI");
      }
    };
    fetchStats();
    timer = setInterval(fetchStats, 2000);
    return () => clearInterval(timer);
  }, []);

  // Values from API (fallback to 0 when missing)
  const avgRisk = stats?.avg_risk ?? 0;
  const avgConf = stats?.avg_confidence ?? 0;
  const total = stats?.total_predictions ?? 0;
  const critical = stats?.health_state_counts?.CRITICAL_STRESS ?? 0;
  const anomalyRate = total ? (critical / total) * 100 : 0;

  let statusTitle = "NORMAL";
  let riskLevel = "Low";
  let statusColor = "#22c55e"; // green
  if (avgRisk >= 0.5 || anomalyRate >= 5) {
    statusTitle = "ELEVATED STRESS";
    riskLevel = "Medium";
    statusColor = "#f59e0b"; // amber
  }
  if (avgRisk >= 0.8 || anomalyRate >= 10) {
    statusTitle = "CRITICAL STRESS";
    riskLevel = "High";
    statusColor = "#ef4444"; // red
  }

  const meterPct = Math.round(Math.min(Math.max(avgRisk, 0), 1) * 100);

  return (
    <div style={{ position: "absolute" as const, top: 250, right: 0, width: 320, zIndex: 200 }}>
      {/* Bridge Health Status Card */}
      <div style={{
        background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12, color: "#fff", padding: 16, marginBottom: 14,
        boxShadow: "0 10px 25px rgba(0,0,0,0.35)"
      }}>
        <div style={{ color: "#22d3ee", fontWeight: 700, marginBottom: 8 }}>
          🧱 Bridge Health Status
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>{health?.model || "Model"}</div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>
          {statusTitle}
        </div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>Risk Level: <span style={{ color: statusColor, fontWeight: 700 }}>{riskLevel}</span></div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>Confidence: <span style={{ color: "#22c55e", fontWeight: 700 }}>{(avgConf*100).toFixed(1)}%</span></div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>Risk Score: <span style={{ color: "#93c5fd", fontWeight: 700 }}>{avgRisk.toFixed(2)}</span></div>
        <div style={{ fontSize: 12, color: "#bbb", marginBottom: 10 }}>
          {anomalyRate >= 10 ? "Critical stress, frequent anomalies detected" :
           anomalyRate >= 5 ? "Elevated stress, intermittent anomalies observed" :
           "Structure operating within normal parameters"}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#22c55e" }}>Risk Meter</div>
        <div style={{ height: 14, width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{
            width: `${meterPct}%`, height: "100%",
            background: "linear-gradient(90deg, #22c55e, #eab308, #ef4444)",
            transition: "width 0.4s ease"
          }} />
        </div>
      </div>

      {/* Statistics Card */}
      <div style={{
        background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12, color: "#fff", padding: 16,
        boxShadow: "0 10px 25px rgba(0,0,0,0.35)"
      }}>
        <div style={{ color: "#34d399", fontWeight: 700, marginBottom: 10 }}>
          📊 Statistics
        </div>
        {!stats && !error && <div style={{ color: "#bbb", fontSize: 12 }}>Connecting to FastAPI...</div>}
        {error && <div style={{ color: "#f88", fontSize: 12 }}>FastAPI error: {error}</div>}
        {stats && (
          <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#aaa" }}>Total Predictions:</span>
              <span style={{ fontWeight: 700 }}>{total.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#aaa" }}>Avg Confidence:</span>
              <span style={{ fontWeight: 700 }}>{(avgConf*100).toFixed(1)}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#aaa" }}>Avg Risk:</span>
              <span style={{ fontWeight: 700 }}>{avgRisk.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ArduinoSimulation;

// --- Dashboard that mirrors python/index.html using FastAPI /predict ---
interface PredictResponse {
  timestamp: number;
  degradation_score: number;
  forecast_score_next_30d: number;
  structural_condition: number;
  condition_label: string;
  confidence: number; // 0..1
  risk_level: string;
  description: string;
  color: string; // hex
}

function BridgeHealthFromFastAPI() {
  const [latest, setLatest] = useState<PredictResponse | null>(null);
  const [trend, setTrend] = useState<PredictResponse[]>([]);
  const API = "http://127.0.0.1:8000/predict";

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const tick = async () => {
      try {
        const res = await fetch(API);
        const data: PredictResponse = await res.json();
        setLatest(data);
        setTrend((prev) => [...prev.slice(-19), data]); // keep last 20
      } catch (e) {
        // ignore fetch failures to avoid UI spam
      }
    };
    tick();
    timer = setInterval(tick, 2500);
    return () => clearInterval(timer);
  }, []);

  const riskPct = Math.round(((latest?.confidence ?? 0) * 100));

  return (
    <>
      {/* Health card */}
      <div style={{
        background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12, color: "#fff", padding: 16,
      }}>
        <div style={{ color: "#22d3ee", fontWeight: 700, marginBottom: 8 }}>Bridge Health Status</div>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
          {(latest?.condition_label || "--").replace('_', ' ')}
        </div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>Risk Level: <span style={{ color: "#f87171", fontWeight: 700 }}>{latest?.risk_level || "--"}</span></div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>Degradation Score: <span style={{ color: "#93c5fd", fontWeight: 700 }}>{latest?.degradation_score?.toFixed?.(2) ?? "--"}</span></div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>Forecast (Next 30d): <span style={{ color: "#22d3ee", fontWeight: 700 }}>{latest?.forecast_score_next_30d?.toFixed?.(2) ?? "--"}</span></div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>Confidence: <span style={{ color: "#22c55e", fontWeight: 700 }}>{latest ? (latest.confidence*100).toFixed(1) + '%' : '--'}</span></div>
        <div style={{ fontSize: 12, color: "#bbb", marginTop: 6 }}>{latest?.description || ''}</div>
        <div style={{ marginTop: 10, marginBottom: 6, color: "#22c55e", fontWeight: 700 }}>Risk Meter</div>
        <div style={{ height: 16, background: "rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{
            width: `${riskPct}%`, height: "100%",
            background: "linear-gradient(90deg, #22c55e, #eab308, #ef4444)",
            transition: "width 0.4s ease"
          }} />
        </div>
      </div>

      {/* Trend chart */}
      <div style={{
        background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12, color: "#fff", padding: 12, height: 300
      }}>
        <div style={{ color: "#22d3ee", fontWeight: 700, marginBottom: 8 }}>Score Trends</div>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <LineChart data={trend.map(t => ({
              time: new Date(t.timestamp).toLocaleTimeString(),
              degradation: t.degradation_score,
              forecast: t.forecast_score_next_30d,
            }))}>
              <CartesianGrid stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fontSize: 10 }} hide={false} />
              <YAxis stroke="#9CA3AF" domain={[50, 100]} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="degradation" stroke="#f59e0b" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="forecast" stroke="#22d3ee" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
