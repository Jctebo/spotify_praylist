FROM python:3.11-slim

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_ROOT_USER_ACTION=ignore \
    DEBIAN_FRONTEND=noninteractive \
    USERPROFILE=/data \
    PAGE_AUDIO_CACHE_DIR=/data/cache/page_audio \
    PAGE_AUDIO_LIBRARY_DIR=/data/page_audio_library \
    NOVENA_AUDIO_LIBRARY_DIR=/data/novena_audio_library \
    DEVOTIONAL_ONEDRIVE_DCIM_DIR=/data/devotional/DCIM

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        fonts-dejavu-core \
        git \
        sudo \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data \
    && groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && echo "$USERNAME ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME \
    && chown -R vscode:vscode /data
