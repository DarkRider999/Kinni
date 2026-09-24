# CPU image for the API and worker. The GPU worker image (CUDA + torch + Real-ESRGAN) is built with
#   docker build --build-arg EXTRAS=postgres,torch --build-arg BASE=nvidia/cuda:12.4.1-runtime-ubuntu22.04 ...
ARG BASE=python:3.11-slim
FROM ${BASE}

ARG EXTRAS=postgres
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    NF_MODELS_DIR=/models NF_STORAGE_DIR=/data/storage

# libEGL/GLES: MediaPipe tasks load them even on CPU
RUN apt-get update && apt-get install -y --no-install-recommends libegl1 libgles2 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY neonforge ./neonforge
COPY scripts ./scripts
RUN pip install ".[${EXTRAS}]" && python scripts/fetch_models.py --dir /models

RUN useradd -r -u 10001 nf && mkdir -p /data && chown -R nf /data
USER nf
EXPOSE 8000
CMD ["uvicorn", "neonforge.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
