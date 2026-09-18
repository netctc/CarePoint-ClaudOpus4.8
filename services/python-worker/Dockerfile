# syntax=docker/dockerfile:1
FROM python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/services/python-worker

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      perl-base=5.40.1-6+deb13u1 \
      libsqlite3-0=3.46.1-7+deb13u2 \
      gzip=1.13-1+deb13u1 \
      libpcre2-8-0=10.46-1~deb13u2 \
 && rm -rf /var/lib/apt/lists/*

RUN addgroup --system carepoint && adduser --system --ingroup carepoint --uid 10001 carepoint

COPY services/python-worker/requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip==26.2.1 setuptools==78.1.1 \
 && python -m pip install -r requirements.txt \
 && python -c "import importlib.metadata as m; assert m.version('msgpack') == '1.2.1'" \
 && python -m pip uninstall -y pip setuptools wheel \
 && python -c "import importlib.util as u; assert u.find_spec('pip') is None and u.find_spec('setuptools') is None and u.find_spec('wheel') is None"

COPY services/python-worker ./

USER carepoint
EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; p=os.environ.get('PYTHON_WORKER_API_PORT','8010'); urllib.request.urlopen(f'http://127.0.0.1:{p}/livez', timeout=3).read()"

CMD ["uvicorn", "carepoint_python_worker.main:app", "--host", "0.0.0.0", "--port", "8010"]
