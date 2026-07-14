FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libxcb1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install dependencies
# We use a reliable python version (3.11) where pre-built wheels are typically available
# to avoid compiling C++ extensions from scratch.
RUN pip install --no-cache-dir --upgrade pip

COPY face-recognition-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the model download script and run it so weights are baked into the image layer
COPY face-recognition-service/download_model.py .
RUN python download_model.py

# Copy application code
COPY face-recognition-service/main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
