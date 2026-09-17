# Usar imagem base estável do Python
FROM python:3.10-slim

# Evitar prompts durante a instalação
ENV DEBIAN_FRONTEND=noninteractive

# Instalar ExifTool e dependências do sistema
RUN apt-get update && apt-get install -y \
    exiftool \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Copiar dependências e instalar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o código fonte do backend
COPY . .

# Criar pasta para processamento temporário
RUN mkdir -p temp_processing && chmod 777 temp_processing

# Expor a porta do FastAPI
EXPOSE 8000

# Comando para rodar a aplicação
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
