# Use official Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Expose the port Cloud Run expects
EXPOSE 8080

# Start Gunicorn (Replace 'aidflow_backend' with your actual Django project folder name)
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "aidflow.wsgi:application"]