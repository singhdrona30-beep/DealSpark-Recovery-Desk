FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir uv
WORKDIR /app

COPY pyproject.toml requirements.txt ./
RUN uv pip install --system -r requirements.txt

COPY agent.py ./

CMD ["python", "agent.py", "start"]
