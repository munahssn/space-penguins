# SPHEREx Blink backend. Build and run from backend/:
#   docker build -t spherex-api .
#   docker run --rm -p 8000:7860 spherex-api
FROM python:3.13-slim

# Hosting platforms run the container as user id 1000, so the app files must belong to that user
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1
RUN mkdir -p $HOME/app/cache
WORKDIR $HOME/app

# Dependencies first: this layer is reused while only the code changes
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=user . .

# One process only: running jobs are kept in memory.
# PORT is set by Cloud Run and Render; Hugging Face Spaces expects 7860.
EXPOSE 7860
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
