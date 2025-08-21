# 🎬 Trakto Video Platform

Uma plataforma completa de processamento de vídeos construída com NestJS, React e Firebase, oferecendo upload, compressão e acompanhamento em tempo real do progresso.

## 🚀 Funcionalidades

- **Upload de Vídeos**: Upload seguro com URLs assinadas
- **Processamento em Tempo Real**: Atualizações de progresso via WebSockets
- **Compressão de Vídeo**: Compressão automática para múltiplas qualidades
- **Armazenamento em Nuvem**: Integração com Google Cloud Storage
- **Arquitetura Pub/Sub**: Processamento escalável com filas de mensagens
- **Interface Moderna**: Frontend React + TypeScript com Tailwind CSS
- **Thumbnails Automáticos**: Geração automática de miniaturas
- **Download Flexível**: Download em qualidade original ou comprimida

## 🏗️ Arquitetura

### Serviços
- **Server**: API NestJS com TypeScript (Porta 3000)
- **Worker**: Serviço de processamento de vídeos em background
- **Web**: Frontend React com Vite (Porta 5173)
- **Nginx**: Proxy reverso opcional (Porta 80)

### Infraestrutura
- **Storage**: Google Cloud Storage
- **Queue**: Google Pub/Sub
- **Database**: Firebase Firestore
- **Real-time**: Socket.IO WebSockets
- **Processing**: FFmpeg

## 📋 Pré-requisitos

- Node.js 18+
- Docker & Docker Compose
- Projeto Google Cloud com:
  - Bucket do Cloud Storage
  - Tópico e subscription do Pub/Sub
  - Projeto Firebase com Firestore
  - Service account com permissões apropriadas

## 🔧 Configuração

### 1. Clone do repositório
```bash
git clone <repository-url>
cd NestJS-Video-Compress-API
```

### 2. Configuração do ambiente
```bash
cp .env.example .env
```

### 3. Configure o arquivo `.env`
Edite o arquivo `.env` com suas credenciais:

```env
# Google Cloud Platform
GCP_PROJECT_ID=seu_project_id
GCS_BUCKET=seu_bucket_name
PUBSUB_TOPIC=video-uploads
PUBSUB_SUBSCRIPTION=video-processor-sub

# Firebase
FIREBASE_PROJECT_ID=seu_firebase_project_id
FIREBASE_CLIENT_EMAIL=seu_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"

# Aplicação
WEBSOCKET_CORS_ORIGIN=http://localhost:5173
INTERNAL_API_SECRET=dev-secret-key-123
WEBSOCKET_HEARTBEAT_INTERVAL=25000
WEBSOCKET_HEARTBEAT_TIMEOUT=60000

# Retry Configuration
MAX_RETRY_ATTEMPTS=3
RETRY_BACKOFF_MS=5000

# Video Processing
MAX_FILE_SIZE_MB=500
ALLOWED_VIDEO_TYPES=video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/x-flv,video/3gpp,video/x-m4v,video/x-ms-wmv,video/mpeg

# FFmpeg Performance Configuration
FFMPEG_PRESET=fast
FFMPEG_CRF=23
FFMPEG_THREADS=0
FFMPEG_MAX_BITRATE=8000
FFMPEG_TARGET_RESOLUTION=854x480

# Processing Performance
MAX_PROCESSING_FILE_SIZE_MB=2000
TEMP_DIR_CLEANUP_DELAY_MS=60000
CONCURRENT_UPLOADS=2
```

### 4. Inicie a aplicação
```bash
docker-compose up --build
```

## 🌐 Acesso aos Serviços

Após iniciar, a aplicação estará disponível em:
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000
- **Worker**: Serviço em background
- **Nginx** (opcional): http://localhost:80

## 📱 Como Usar

1. Acesse a interface web em http://localhost:5173
2. Faça upload de arquivos de vídeo (formatos suportados: MP4, WebM, QuickTime, AVI)
3. Acompanhe o progresso de processamento em tempo real
4. Baixe vídeos processados em diferentes qualidades
5. Visualize thumbnails e gerencie sua biblioteca de vídeos
6. Delete vídeos quando necessário

## 🛠️ Desenvolvimento

### Executar serviços individualmente
```bash
# Apenas o servidor
docker-compose up server

# Apenas o frontend
docker-compose up web

# Apenas o worker
docker-compose up worker

# Com nginx
docker-compose --profile nginx up
```

### Logs dos serviços
```bash
docker-compose logs server
docker-compose logs worker
docker-compose logs web
```

## 📖 Documentação da API

### Endpoints de Vídeo

#### `POST /api/videos/upload-url`
Gera uma URL assinada para upload de vídeo.

**Request Body:**
```json
{
  "fileName": "video.mp4",
  "contentType": "video/mp4"
}
```

**Response:**
```json
{
  "uploadUrl": "https://storage.googleapis.com/...",
  "videoId": "uuid-do-video",
  "gcsPath": "videos/uuid/video.mp4"
}
```

#### `GET /api/videos`
Lista vídeos com paginação e filtros.

**Query Parameters:**
- `page` (padrão: 1): Página atual
- `limit` (padrão: 20): Itens por página
- `status` (opcional): Filtrar por status (`pending`, `processing`, `completed`, `failed`)
- `search` (opcional): Buscar por nome do arquivo

**Response:**
```json
{
  "videos": [
    {
      "id": "uuid",
      "fileName": "video.mp4",
      "status": "completed",
      "progress": 100,
      "createdAt": "2025-01-01T00:00:00Z",
      "originalGcsPath": "videos/uuid/original.mp4",
      "lowResGcsPath": "videos/uuid/low.mp4",
      "thumbnailGcsPath": "videos/uuid/thumbnail.jpg"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

#### `GET /api/videos/:id`
Obtém detalhes de um vídeo específico.

**Response:**
```json
{
  "id": "uuid",
  "fileName": "video.mp4",
  "status": "completed",
  "progress": 100,
  "originalGcsPath": "videos/uuid/original.mp4",
  "lowResGcsPath": "videos/uuid/low.mp4",
  "thumbnailGcsPath": "videos/uuid/thumbnail.jpg",
  "createdAt": "2025-01-01T00:00:00Z",
  "processedAt": "2025-01-01T00:05:00Z"
}
```

#### `GET /api/videos/:id/download`
Obtém URL de download para vídeo processado.

**Query Parameters:**
- `quality`: `"original"` | `"low"` (padrão: `"low"`)

**Response:**
```json
{
  "downloadUrl": "https://storage.googleapis.com/..."
}
```

#### `GET /api/videos/:id/view`
Obtém URL para visualização/streaming do vídeo.

**Query Parameters:**
- `quality`: `"original"` | `"low"` (padrão: `"low"`)

**Response:**
```json
{
  "viewUrl": "https://storage.googleapis.com/..."
}
```

#### `GET /api/videos/:id/thumbnail`
Obtém URL da thumbnail do vídeo.

**Response:**
```json
{
  "thumbnailUrl": "https://storage.googleapis.com/..."
}
```

#### `POST /api/videos/:id/upload-complete`
Notifica que o upload foi concluído e inicia o processamento.

**Response:**
```json
{
  "success": true
}
```

#### `DELETE /api/videos/:id`
Deleta vídeo e arquivos associados.

**Response:**
```json
{
  "success": true
}
```

### Endpoint de Health Check

#### `GET /`
Health check da API.

**Response:**
```json
{
  "message": "Video Processing API is running!"
}
```

## 🔄 Eventos WebSocket

A aplicação usa Socket.IO para atualizações em tempo real:

### Eventos do Cliente (Escutar)

#### `global-video-progress`
Atualizações de progresso do processamento de vídeo.

**Dados do Evento:**
```javascript
{
  videoId: "uuid-do-video",
  progress: 75,  // 0-100
  status: "processing"
}
```

#### `global-video-completed`
Notificação de conclusão do processamento.

**Dados do Evento:**
```javascript
{
  videoId: "uuid-do-video",
  lowResPath: "videos/uuid/low.mp4"
}
```

#### `global-video-failed`
Notificação de falha no processamento.

**Dados do Evento:**
```javascript
{
  videoId: "uuid-do-video",
  error: "Mensagem de erro"
}
```

## 🐳 Serviços Docker

### Server (API NestJS)
- **Porta**: 3000
- **Dockerfile**: `./server/Dockerfile`
- **Ambiente**: Desenvolvimento com hot reload
- **Volumes**: Código fonte montado para desenvolvimento
- **Dependências**: Firebase, GCS, Pub/Sub

### Web (Frontend React)
- **Porta**: 5173
- **Dockerfile**: `./web/Dockerfile`
- **Ambiente**: Servidor de desenvolvimento Vite
- **Hot Reload**: Código fonte montado como volume
- **Variáveis**: API base URL configurada

### Worker (Processador Background)
- **Dockerfile**: `./worker/Dockerfile`
- **Propósito**: Processamento de vídeo via Pub/Sub
- **Dependências**: FFmpeg, GCS, Pub/Sub
- **Volumes**: Diretório temporário para processamento

### Nginx (Proxy Reverso - Opcional)
- **Porta**: 80
- **Profile**: `nginx`
- **Uso**: `docker-compose --profile nginx up`
- **Configuração**: `nginx.dev.conf`

## 📊 Pipeline de Processamento

1. **Upload**: Cliente obtém URL assinada da API
2. **Armazenamento**: Arquivo enviado diretamente para Google Cloud Storage
3. **Trigger**: API notifica conclusão do upload
4. **Fila**: Job de processamento enviado para Pub/Sub
5. **Processamento**: Worker processa vídeo com FFmpeg
6. **Notificação**: Atualizações de progresso em tempo real via WebSocket
7. **Conclusão**: Vídeo processado e thumbnail armazenados no GCS

## 🔒 Recursos de Segurança

- Validação de tipo de arquivo
- Limites de tamanho de arquivo (configurável)
- Sanitização de nomes de arquivo
- URLs assinadas seguras com expiração
- Validação e sanitização de entrada
- Filtros de exceção globais

## 📝 Formatos de Vídeo Suportados

- **MP4** (video/mp4)
- **WebM** (video/webm)
- **QuickTime** (video/quicktime)
- **AVI** (video/x-msvideo)

## 🎛️ Configurações Avançadas

### Variáveis de Ambiente Principais

```env
# Tamanhos e Limites
MAX_FILE_SIZE_MB=500                    # Tamanho máximo do arquivo
SIGN_URL_EXPIRATION_SECONDS=900         # Expiração da URL de upload (15 min)

# Retry e Performance
MAX_RETRY_ATTEMPTS=3                    # Tentativas de retry
RETRY_BACKOFF_MS=5000                   # Delay entre tentativas

# WebSocket
WEBSOCKET_HEARTBEAT_INTERVAL=25000      # Intervalo de ping
WEBSOCKET_HEARTBEAT_TIMEOUT=60000       # Timeout de conexão
```

### Volumes Docker

```yaml
volumes:
  server_node_modules:    # Cache de dependências do servidor
  web_node_modules:       # Cache de dependências do web
  worker_node_modules:    # Cache de dependências do worker
```

## 🧪 Testes

Execute testes para serviços individuais:

```bash
# Testes do servidor
cd server && npm test

# Testes do frontend
cd web && npm test

# Testes do worker
cd worker && npm test
```

## 🚨 Tratamento de Erros

A aplicação inclui tratamento abrangente de erros:

- Erros de validação de upload
- Falhas de processamento com lógica de retry
- Notificações de erro em tempo real
- Fallbacks elegantes para arquivos ausentes
- Logs estruturados para debugging

## 🔧 Solução de Problemas

### Problemas Comuns

1. **Upload falha**
   - Verifique permissões do GCS e configuração do bucket
   - Confirme se as credenciais estão corretas

2. **Processamento trava**
   - Verifique configuração do tópico e subscription do Pub/Sub
   - Confirme se o worker está rodando

3. **WebSocket desconecta**
   - Verifique configuração de CORS
   - Confirme variável `WEBSOCKET_CORS_ORIGIN`

4. **Arquivos grandes dão timeout**
   - Ajuste timeout de upload e limites de tamanho
   - Verifique `MAX_FILE_SIZE_MB`

### Comandos de Debug

```bash
# Status dos containers
docker-compose ps

# Logs detalhados
docker-compose logs -f server
docker-compose logs -f worker

# Restart de serviço específico
docker-compose restart server

# Rebuild completo
docker-compose down && docker-compose up --build
```

### Health Checks

- **API**: GET http://localhost:3000/
- **Worker**: GET http://localhost:8080/health (interno)
- **Frontend**: http://localhost:5173

## 📈 Monitoramento

A aplicação inclui logs estruturados para monitoramento:

- Progress de processamento de vídeo
- Eventos de WebSocket
- Erros de upload e processamento
- Métricas de performance
