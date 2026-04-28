```python
# main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/hello")
async def read_hello():
    return {"message": "Hello from NexusOS!"}

@app.get("/health")
async def read_health():
    return {"status": "healthy"}
```

### requirements.txt
```plaintext
fastapi==0.95.0
uvicorn==0.22.0
```

### Dockerfile
```dockerfile
# Use the official Python image from the Docker Hub
FROM python:3.9

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Instructions to Run
1. Save the `main.py`, `requirements.txt`, and `Dockerfile` in the same directory.
2. Build the Docker image:
   ```bash
   docker build -t fastapi-nexusos .
   ```
3. Run the Docker container:
   ```bash
   docker run -d -p 8000:8000 fastapi-nexusos
   ```
4. Access the endpoints:
   - `/hello`: `http://localhost:8000/hello`
   - `/health`: `http://localhost:8000/health`