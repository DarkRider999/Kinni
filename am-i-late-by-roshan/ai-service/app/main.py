"""Am I Late? AI service: traffic, ETA, disruption and driver-state models over HTTP."""
from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI

from app import schemas
from app.services import prediction_service

load_dotenv()

app = FastAPI(
    title="Am I Late? AI service",
    version="1.0.0",
    description="Heuristic UAE traffic/ETA models. Each model module can be swapped for a trained model without changing these endpoints.",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "models": {"eta": "heuristic-v1", "traffic": "heuristic-v1", "disruption": "heuristic-v1", "driver_state": "heuristic-v1"}}


@app.post("/predict/traffic", response_model=schemas.TrafficResponse)
def predict_traffic(req: schemas.TrafficRequest) -> schemas.TrafficResponse:
    return prediction_service.predict_traffic(req)


@app.post("/predict/eta", response_model=schemas.EtaResponse)
def predict_eta(req: schemas.EtaRequest) -> schemas.EtaResponse:
    return prediction_service.predict_eta(req)


@app.post("/score/disruption", response_model=schemas.DisruptionResponse)
def score_disruption(req: schemas.DisruptionRequest) -> schemas.DisruptionResponse:
    return prediction_service.score_disruption(req)


@app.post("/score/driver-state", response_model=schemas.DriverStateResponse)
def score_driver_state(req: schemas.DriverStateRequest) -> schemas.DriverStateResponse:
    return prediction_service.score_driver_state(req)
