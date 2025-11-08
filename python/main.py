from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import numpy as np
import pandas as pd
import joblib
from typing import List
import time
import asyncio
import random

app = FastAPI(title="Bridge Structural Health Monitoring")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
rf_model = None
scaler = None
selected_features = None

# Map UCI HAR activities to bridge health states
activity_to_health_state = {
    0: "MINOR_STRESS",          # WALKING → Minor stress
    1: "CRITICAL_STRESS",        # WALKING_UPSTAIRS → Critical stress
    2: "MODERATE_STRESS",        # WALKING_DOWNSTAIRS → Moderate stress
    3: "NORMAL",                 # SITTING → Normal/stable
    4: "MONITORING",             # STANDING → Monitoring
    5: "NORMAL"                  # LAYING → Normal/stable
}

health_states = ["NORMAL", "MONITORING", "MINOR_STRESS", "MODERATE_STRESS", "CRITICAL_STRESS"]

health_state_info = {
    "NORMAL": {
        "color": "#00ff88",
        "risk_level": "Low",
        "description": "Structure stable, minimal vibration"
    },
    "MONITORING": {
        "color": "#00aaff",
        "risk_level": "Low-Medium",
        "description": "Under observation, baseline monitoring"
    },
    "MINOR_STRESS": {
        "color": "#ffff00",
        "risk_level": "Medium",
        "description": "Minor stress detected, normal traffic load"
    },
    "MODERATE_STRESS": {
        "color": "#ff9900",
        "risk_level": "Medium-High",
        "description": "Moderate stress detected, increased load"
    },
    "CRITICAL_STRESS": {
        "color": "#ff4444",
        "risk_level": "High",
        "description": "Critical stress, excessive vibration detected"
    }
}

latest_prediction = {
    "health_state": "NORMAL",
    "confidence": 0.0,
    "risk_score": 0.0,
    "color": "#00ff88",
    "timestamp": 0
}

stats = {
    "total_predictions": 0,
    "health_state_counts": {state: 0 for state in health_states},
    "avg_confidence": 0.0,
    "total_confidence": 0.0,
    "avg_risk": 0.0
}

# ============================================
# LOAD MODEL
# ============================================

@app.on_event("startup")
async def load_models():
    global rf_model, scaler, selected_features
    
    try:
        print("Loading Random Forest model...")
        rf_model = joblib.load('rf_ucihar_model.pkl')
        scaler = joblib.load('scaler.pkl')
        print("✅ Random Forest model loaded")
        print(f"   Model trained on {rf_model.n_features_in_} features")
        
        try:
            selected_features = joblib.load('selected_features.pkl')
            print(f"✅ Selected features loaded: {len(selected_features)} features")
        except:
            print("⚠  Using all features")
            selected_features = None
        
        asyncio.create_task(auto_generate_predictions())
        print("✅ Synthetic data generator started")
            
    except Exception as e:
        print(f"❌ Error loading models: {e}")
        import traceback
        traceback.print_exc()

# ============================================
# SYNTHETIC DATA GENERATOR
# ============================================

def generate_synthetic_sensor_data():
    """Generate synthetic sensor data"""
    activity_type = random.randint(0, 5)
    
    if selected_features is not None:
        n_features = len(selected_features)
    else:
        n_features = rf_model.n_features_in_
    
    # Generate patterns matching bridge stress levels
    if activity_type in [0, 2]:  # Minor/Moderate stress - medium variance
        features = np.random.normal(0, 1.0, n_features)
    elif activity_type == 1:  # Critical stress - high variance
        features = np.random.normal(0, 2.0, n_features)
    else:  # Normal/Monitoring - low variance
        features = np.random.normal(0, 0.3, n_features)
    
    return features.tolist()

def calculate_risk_score(health_state, confidence):
    """Calculate risk score based on health state and confidence"""
    base_risk = {
        "NORMAL": 0.1,
        "MONITORING": 0.3,
        "MINOR_STRESS": 0.5,
        "MODERATE_STRESS": 0.7,
        "CRITICAL_STRESS": 0.9
    }
    
    # Higher confidence means more certain about the risk level
    return base_risk[health_state] * confidence

async def auto_generate_predictions():
    """Background task generating predictions"""
    global latest_prediction, stats
    
    while True:
        try:
            if rf_model is None or scaler is None:
                await asyncio.sleep(1)
                continue
            
            # Generate synthetic data
            features = generate_synthetic_sensor_data()
            features_array = np.array(features).reshape(1, -1)
            
            # Predict activity
            prediction = rf_model.predict(features_array)[0]
            probabilities = rf_model.predict_proba(features_array)[0]
            confidence = float(probabilities[prediction])
            
            # Map to bridge health state
            health_state = activity_to_health_state[prediction]
            risk_score = calculate_risk_score(health_state, confidence)
            
            # Update statistics
            stats["total_predictions"] += 1
            stats["health_state_counts"][health_state] += 1
            stats["total_confidence"] += confidence
            stats["avg_confidence"] = stats["total_confidence"] / stats["total_predictions"]
            stats["avg_risk"] = ((stats.get("avg_risk", 0) * (stats["total_predictions"] - 1) + risk_score) 
                                 / stats["total_predictions"])
            
            # Update latest prediction
            latest_prediction = {
                "health_state": health_state,
                "confidence": confidence,
                "risk_score": risk_score,
                "color": health_state_info[health_state]["color"],
                "risk_level": health_state_info[health_state]["risk_level"],
                "description": health_state_info[health_state]["description"],
                "timestamp": int(time.time() * 1000)
            }
            
            print(f"🌉 [{stats['total_predictions']}] {health_state} | Confidence: {confidence:.0%} | Risk: {risk_score:.2f}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
        
        await asyncio.sleep(2)

# ============================================
# API ENDPOINTS
# ============================================

class PredictionRequest(BaseModel):
    features: List[float]

class PredictionResponse(BaseModel):
    health_state: str
    confidence: float
    risk_score: float
    color: str
    risk_level: str
    description: str
    timestamp: int

@app.get("/")
async def serve_frontend():
    return FileResponse("index.html")

@app.get("/health")
def health_check():
    if rf_model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return {
        "status": "healthy",
        "model": "Random Forest - Bridge Health Monitoring",
        "n_features": rf_model.n_features_in_,
        "health_states": health_states,
        "total_predictions": stats["total_predictions"]
    }

@app.get("/latest")
async def get_latest():
    return latest_prediction

@app.get("/stats")
async def get_stats():
    return stats

@app.post("/predict", response_model=PredictionResponse)
async def predict_health(request: PredictionRequest):
    global latest_prediction, stats
    
    if rf_model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        features = np.array(request.features).reshape(1, -1)
        
        if features.shape[1] != rf_model.n_features_in_:
            raise HTTPException(
                status_code=400,
                detail=f"Expected {rf_model.n_features_in_} features, got {features.shape[1]}"
            )
        
        # Predict
        prediction = rf_model.predict(features)[0]
        probabilities = rf_model.predict_proba(features)[0]
        confidence = float(probabilities[prediction])
        
        health_state = activity_to_health_state[prediction]
        risk_score = calculate_risk_score(health_state, confidence)
        
        # Update stats
        stats["total_predictions"] += 1
        stats["health_state_counts"][health_state] += 1
        stats["total_confidence"] += confidence
        stats["avg_confidence"] = stats["total_confidence"] / stats["total_predictions"]
        
        latest_prediction = {
            "health_state": health_state,
            "confidence": confidence,
            "risk_score": risk_score,
            "color": health_state_info[health_state]["color"],
            "risk_level": health_state_info[health_state]["risk_level"],
            "description": health_state_info[health_state]["description"],
            "timestamp": int(time.time() * 1000)
        }
        
        return PredictionResponse(**latest_prediction)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*70)
    print("🌉 Bridge Structural Health Monitoring System")
    print("="*70)
    print("📊 Dashboard: http://localhost:8000")
    print("🔍 Health:    http://localhost:8000/health")
    print("📈 Stats:     http://localhost:8000/stats")
    print("="*70 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8001)
