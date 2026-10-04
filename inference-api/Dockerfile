FROM python:3.12-slim

# INSTALL_ML=true installe PyTorch (CPU) pour charger de vrais poids.
ARG INSTALL_ML=false
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /srv
COPY requirements.txt requirements-ml.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && if [ "$INSTALL_ML" = "true" ]; then \
      pip install --no-cache-dir -r requirements-ml.txt --extra-index-url https://download.pytorch.org/whl/cpu; \
    fi

COPY app ./app
COPY configs ./configs

RUN useradd --system --uid 10001 prescan && chown -R prescan /srv
USER prescan

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
