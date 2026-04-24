# syntax=docker/dockerfile:1.7
FROM python:3.11-slim

ARG APP_UID=10001
ARG APP_GID=10001

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_ROOT_USER_ACTION=ignore \
    DEBIAN_FRONTEND=noninteractive \
    HOME=/home/app \
    USERPROFILE=/data \
    PAGE_AUDIO_CACHE_DIR=/data/cache/page_audio \
    PAGE_AUDIO_LIBRARY_DIR=/data/page_audio_library \
    NOVENA_AUDIO_LIBRARY_DIR=/data/novena_audio_library \
    DEVOTIONAL_ONEDRIVE_DCIM_DIR=/data/devotional/DCIM

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid "${APP_GID}" app \
    && useradd --uid "${APP_UID}" --gid "${APP_GID}" --create-home app \
    && mkdir -p /data \
    && chown -R app:app /data /app

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    PIP_NO_CACHE_DIR=0 python -m pip install --upgrade pip \
    && PIP_NO_CACHE_DIR=0 python -m pip install -r requirements.txt

COPY --chown=app:app . .

USER app

VOLUME ["/data"]

CMD ["python", "-m", "jobs.playlist.refresh_playlist"]
