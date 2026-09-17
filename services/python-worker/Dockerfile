# syntax=docker/dockerfile:1
FROM python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/services/python-worker

RUN addgroup --system carepoint && adduser --system --ingroup carepoint --uid 10001 carepoint

COPY services/python-worker/requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip==26.2.1 && python -m pip install -r requirements.txt

COPY services/python-worker ./

USER carepoint
EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; p=os.environ.get('PYTHON_WORKER_API_PORT','8010'); urllib.request.urlopen(f'http://127.0.0.1:{p}/livez', timeout=3).read()"

CMD ["uvicorn", "carepoint_python_worker.main:app", "--host", "0.0.0.0", "--port", "8010"]
