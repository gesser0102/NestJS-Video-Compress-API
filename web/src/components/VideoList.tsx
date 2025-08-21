import React, { useEffect, useState } from 'react';
import { videoApi } from '../services/api';
import { socketService } from '../services/socket';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import type { VideoProcessing } from '../types/video';

interface ThumbnailComponentProps {
  videoId: string;
  thumbnailPath?: string;
  fileName: string;
}

const ThumbnailComponent: React.FC<ThumbnailComponentProps> = ({ videoId, thumbnailPath, fileName }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (thumbnailPath && !thumbnailUrl && !error) {
      videoApi.getThumbnailUrl(videoId)
        .then(setThumbnailUrl)
        .catch(() => setError(true));
    }
  }, [videoId, thumbnailPath, thumbnailUrl, error]);

  if (error || !thumbnailPath) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">🎬</div>
          <div className="text-xs text-gray-400 font-medium">Sem thumbnail</div>
        </div>
      </div>
    );
  }

  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt={`Thumbnail de ${fileName}`}
        className="w-full h-full object-cover"
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-2">🎬</div>
        <div className="text-xs text-gray-400 font-medium">Carregando...</div>
      </div>
    </div>
  );
};

interface VideoListProps {
  refreshTrigger?: number;
  processingVideos?: Array<{ videoId: string; fileName: string }>;
  onVideoAppeared?: (videoId: string) => void;
  onVideoCountChange?: (count: number) => void;
}

export const VideoList: React.FC<VideoListProps> = ({ refreshTrigger, processingVideos = [], onVideoAppeared, onVideoCountChange }) => {
  const [videos, setVideos] = useState<VideoProcessing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [internalRefreshTrigger, setInternalRefreshTrigger] = useState(0);
  const [deletingVideos, setDeletingVideos] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<{ id: string; fileName: string } | null>(null);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const limit = 20;
  const maxRetries = 3;

  const loadVideos = async (isRetry = false) => {
    try {
      if (!isRetry) {
        setLoading(true);
        setError(null);
      } else {
        setIsRetrying(true);
      }
      
      const response = await videoApi.getVideos(
        page,
        limit
      );
      setVideos(response.items);
      setTotal(response.total);
      onVideoCountChange?.(response.total);
      setRetryCount(0);
      setError(null);
      
      // Verificar se algum vídeo em processamento agora apareceu na lista
      if (onVideoAppeared) {
        response.items.forEach(video => {
          if (processingVideos.some(pv => pv.videoId === video.id)) {
            onVideoAppeared(video.id);
          }
        });
      }
    } catch (err) {
      
      if (retryCount < maxRetries) {
        const nextRetryCount = retryCount + 1;
        setRetryCount(nextRetryCount);
        setError(`Falha ao carregar vídeos. Tentativa ${nextRetryCount}/${maxRetries}...`);
        
        // Exponential backoff: 2s, 4s, 8s
        const retryDelay = Math.pow(2, nextRetryCount) * 1000;
        
        setTimeout(() => {
          loadVideos(true);
        }, retryDelay);
      } else {
        setError('Servidor indisponível. Tentando reconectar...');
        setRetryCount(0);
      }
    } finally {
      if (!isRetry) {
        setLoading(false);
      } else {
        setIsRetrying(false);
      }
    }
  };

  useEffect(() => {
    loadVideos();
  }, [page, refreshTrigger, internalRefreshTrigger]);

  useEffect(() => {
    // Connect to WebSocket
    socketService.connect();
    
    // Set initial connection status
    setIsWebSocketConnected(socketService.isConnected());
    
    // Listen for connection changes
    const handleConnectionChange = (connected: boolean) => {
      const wasDisconnected = !isWebSocketConnected;
      setIsWebSocketConnected(connected);
      
      if (connected) {
        
        // If we were disconnected and now reconnected, reload videos
        if (wasDisconnected) {
          setRetryCount(0); // Reset retry count
          loadVideos(); // Reload videos
        }
      } else {
      }
    };
    
    socketService.onConnectionChange(handleConnectionChange);

    // Setup global WebSocket listeners for real-time updates
    const handleGlobalVideoProgress = (data: { videoId: string; progress: number; status: string }) => {
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.id === data.videoId 
            ? { ...video, progress: data.progress, status: data.status as 'queued' | 'processing' | 'done' | 'failed', updatedAt: new Date() }
            : video
        )
      );
    };

    const handleGlobalVideoCompleted = (data: { videoId: string; lowResPath: string }) => {
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.id === data.videoId 
            ? { ...video, progress: 100, status: 'done', lowResGcsPath: data.lowResPath, updatedAt: new Date() }
            : video
        )
      );
      // Trigger refresh to get updated metadata (thumbnail path, etc.)
      setTimeout(() => setInternalRefreshTrigger(prev => prev + 1), 1000);
    };

    const handleGlobalVideoFailed = (data: { videoId: string; error: string }) => {
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.id === data.videoId 
            ? { ...video, status: 'failed', progress: 0, error: data.error, updatedAt: new Date() }
            : video
        )
      );
    };

    socketService.onGlobalVideoProgress(handleGlobalVideoProgress);
    socketService.onGlobalVideoCompleted(handleGlobalVideoCompleted);
    socketService.onGlobalVideoFailed(handleGlobalVideoFailed);

    return () => {
      socketService.offConnectionChange(handleConnectionChange);
      socketService.offGlobalVideoProgress(handleGlobalVideoProgress);
      socketService.offGlobalVideoCompleted(handleGlobalVideoCompleted);
      socketService.offGlobalVideoFailed(handleGlobalVideoFailed);
    };
  }, []);

  // Fallback polling system - only activated when WebSocket disconnects
  useEffect(() => {
    if (isWebSocketConnected) return; // Don't poll if WebSocket is connected

    const processingVideos = videos.filter(video => 
      video.status === 'processing' || video.status === 'queued'
    );

    if (processingVideos.length === 0) return;


    const pollProcessingVideos = async () => {
      try {
        const promises = processingVideos.map(async (video) => {
          const updated = await videoApi.getVideoById(video.id);
          return updated;
        });
        
        const updatedVideos = await Promise.all(promises);
        
        setVideos(prevVideos => {
          const videoMap = new Map(updatedVideos.map(v => [v.id, v]));
          return prevVideos.map(video => {
            const updated = videoMap.get(video.id);
            if (updated && (updated.progress !== video.progress || updated.status !== video.status)) {
              return { ...updated, updatedAt: new Date() };
            }
            return video;
          });
        });

      } catch (error) {
      }
    };

    const interval = setInterval(pollProcessingVideos, 5000); // Poll every 5 seconds when WebSocket is down
    return () => clearInterval(interval);
  }, [isWebSocketConnected, videos]);

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('pt-BR');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const openDeleteModal = (videoId: string, fileName: string) => {
    setVideoToDelete({ id: videoId, fileName });
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setVideoToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!videoToDelete) return;

    const { id: videoId, fileName } = videoToDelete;
    setDeletingVideos(prev => new Set(prev).add(videoId));

    try {
      await videoApi.deleteVideo(videoId);
      
      // Remove video from local state
      setVideos(prev => prev.filter(video => video.id !== videoId));
      
      // Update total count
      setTotal(prev => {
        const newTotal = prev - 1;
        onVideoCountChange?.(newTotal);
        return newTotal;
      });
      
      closeDeleteModal();
    } catch (error) {
      setError(`Falha ao deletar o vídeo "${fileName}". Tente novamente.`);
    } finally {
      setDeletingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }
  };


  const getStatusBadge = (status: string) => {
    const colors = {
      queued: 'bg-yellow-900 text-yellow-300 border-yellow-600',
      processing: 'bg-blue-900 text-blue-300 border-blue-600',
      done: 'bg-green-900 text-green-300 border-green-600',
      failed: 'bg-red-900 text-red-300 border-red-600',
    };
    
    const labels = {
      queued: 'Na fila',
      processing: 'Processando',
      done: 'Concluído',
      failed: 'Falhou',
    };

    const icons = {
      queued: '⏳',
      processing: '🔄',
      done: '✅',
      failed: '❌',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${colors[status as keyof typeof colors] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
        <span>{icons[status as keyof typeof icons] || '📄'}</span>
        <span>{labels[status as keyof typeof labels] || status}</span>
      </span>
    );
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && videos.length === 0) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="flex items-center space-x-2 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Carregando vídeos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status with Enhanced Indicators */}
      <div className={`p-3 rounded-lg border flex items-center justify-between ${
        isWebSocketConnected 
          ? 'bg-green-900/20 border-green-700/30 text-green-300' 
          : retryCount > 0 || isRetrying
            ? 'bg-orange-900/20 border-orange-700/30 text-orange-300'
            : 'bg-yellow-900/20 border-yellow-700/30 text-yellow-300'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${
            isWebSocketConnected 
              ? 'bg-green-400 animate-pulse' 
              : retryCount > 0 || isRetrying
                ? 'bg-orange-400 animate-spin'
                : 'bg-yellow-400'
          }`} />
          <span className="text-sm font-medium">
            {isWebSocketConnected 
              ? '🔗 Conectado - Atualizações em tempo real ativas' 
              : retryCount > 0 || isRetrying
                ? `🔄 Reconectando... Tentativa ${retryCount}/${maxRetries}`
                : '⚠️ Desconectado - Usando modo fallback'
            }
          </span>
        </div>
        
        {/* Manual Retry Buttons */}
        {!isWebSocketConnected && retryCount === 0 && !isRetrying && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => loadVideos()}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Recarregar</span>
            </button>
            <button
              onClick={() => socketService.forceReconnect()}
              className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              <span>Reconectar</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className={`p-4 border rounded-lg flex items-center justify-between ${
          retryCount > 0 || isRetrying
            ? 'bg-orange-900/30 border-orange-600 text-orange-300'
            : 'bg-red-900 border-red-600 text-red-300'
        }`}>
          <div className="flex items-center space-x-2">
            {retryCount > 0 || isRetrying ? (
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{error}</span>
          </div>
          
          {/* Countdown or progress for retry */}
          {(retryCount > 0 || isRetrying) && (
            <div className="text-xs text-orange-400 font-mono">
              {isRetrying ? 'Conectando...' : 'Aguarde...'}
            </div>
          )}
        </div>
      )}

      {/* Header da Lista de Vídeos com Feedback Visual */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h2 className="text-xl font-semibold text-white">Vídeos</h2>
          
          {/* Indicador de vídeos sendo processados */}
          {processingVideos.length > 0 && (
            <div className="flex items-center space-x-3 bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-1.5">
              {/* Loader animado */}
              <div className="flex items-center space-x-1">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              
              <span className="text-blue-300 text-sm font-medium">
                {processingVideos.length === 1 
                  ? `Adicionando "${processingVideos[0].fileName.length > 20 ? processingVideos[0].fileName.substring(0, 20) + '...' : processingVideos[0].fileName}"`
                  : `Adicionando ${processingVideos.length} vídeos`
                }
              </span>
            </div>
          )}
        </div>
        
        {/* Contador total de vídeos */}
        {total > 0 && (
          <span className="text-gray-400 text-sm">
            {total} vídeo{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📹</div>
          <div className="text-gray-400">Nenhum vídeo encontrado</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <div 
              key={video.id} 
              className={`bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${
                deletingVideos.has(video.id) ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {/* Video Thumbnail */}
              <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                <ThumbnailComponent
                  videoId={video.id}
                  thumbnailPath={video.thumbnailGcsPath}
                  fileName={video.originalFileName}
                />
                
                {/* Status Badge and Delete Button */}
                <div className="absolute top-3 right-3 flex items-center space-x-2">
                  {getStatusBadge(video.status)}
                  
                  {/* Delete Button - Only show for completed or failed videos */}
                  {(video.status === 'done' || video.status === 'failed') && (
                    !deletingVideos.has(video.id) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(video.id, video.originalFileName);
                        }}
                        className="bg-red-900/80 hover:bg-red-800/90 text-red-300 hover:text-red-200 rounded-full p-1.5 transition-all duration-200 backdrop-blur-sm border border-red-700/50 hover:border-red-600"
                        title={`Deletar ${video.originalFileName}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    ) : (
                      <div className="bg-red-900/80 text-red-300 rounded-full p-1.5 backdrop-blur-sm border border-red-700/50">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                    )
                  )}
                </div>

                {/* Progress Overlay for Processing Videos */}
                {(video.status === 'processing' || video.status === 'queued') && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm">
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-300 font-medium">
                          {video.status === 'processing' ? 'Processando' : 'Na fila'}
                        </span>
                        <span className="text-xs text-gray-300 font-bold">
                          {video.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            video.status === 'processing' 
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                              : 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                          }`}
                          style={{ width: `${Math.max(5, video.progress)}%` }}
                        />
                      </div>
                      {video.status === 'processing' && (
                        <div className="flex items-center justify-center mt-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
                          <span className="ml-2 text-xs text-blue-400 font-medium">
                            Pode levar alguns minutos...
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Content */}
              <div className="p-4">
                {/* File Name */}
                <h3 className="text-white font-semibold text-sm mb-2 truncate" title={video.originalFileName}>
                  {video.originalFileName}
                </h3>

                {/* Video Details */}
                <div className="space-y-3 mb-4">
                  {/* Duration */}
                  {video.durationSeconds && (
                    <div className="flex items-center text-xs text-gray-400">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {Math.floor(video.durationSeconds / 60)}:{(video.durationSeconds % 60).toFixed(0).padStart(2, '0')}
                    </div>
                  )}

                  {/* Original and Low Res Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Original Video - Blue theme to match button */}
                    <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-2">
                      <div className="text-blue-300 font-medium mb-1 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 110-2h4z" />
                        </svg>
                        Original
                      </div>
                      {video.originalResolution && (
                        <div className="text-blue-200">{video.originalResolution}</div>
                      )}
                      <div className="text-blue-200">{formatFileSize(video.sizeBytes)}</div>
                    </div>

                    {/* Low Resolution Video - Green theme to match button */}
                    {video.status === 'done' && video.lowResGcsPath && (
                      <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-2">
                        <div className="text-green-300 font-medium mb-1 flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          480p
                        </div>
                        <div className="text-green-200">{video.lowResolution}</div>
                        <div className="text-green-200">{formatFileSize(video.lowResSizeBytes)}</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center text-xs text-gray-400">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(video.createdAt)}
                  </div>
                </div>

                {/* Error Message */}
                {video.status === 'failed' && video.error && (
                  <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                    <div className="flex items-center text-red-400 text-xs">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">Erro no processamento</span>
                    </div>
                    <p className="text-red-300 text-xs mt-1 truncate" title={video.error}>
                      {video.error.length > 50 ? video.error.substring(0, 50) + '...' : video.error}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                {video.status === 'done' && (
                  <div className="space-y-3">
                    {/* Original Video Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const viewUrl = await videoApi.getViewUrl(video.id, 'original');
                            window.open(viewUrl, '_blank');
                          } catch (error) {
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 px-2 rounded-lg transition-colors flex items-center justify-center space-x-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10a1 1 0 01-1-1V4a1 1 0 011-1h7a1 1 0 011 1v5a1 1 0 01-1 1h-1" />
                        </svg>
                        <span>Ver Original</span>
                      </button>
                      
                      <button
                        onClick={async () => {
                          try {
                            const downloadUrl = await videoApi.getDownloadUrl(video.id, 'original');
                            window.open(downloadUrl, '_blank');
                          } catch (error) {
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 px-2 rounded-lg transition-colors flex items-center justify-center space-x-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        <span>Baixar Original</span>
                      </button>
                    </div>

                    {/* Low Resolution Video Buttons */}
                    {video.lowResGcsPath && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const viewUrl = await videoApi.getViewUrl(video.id, 'low');
                              window.open(viewUrl, '_blank');
                            } catch (error) {
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 px-2 rounded-lg transition-colors flex items-center justify-center space-x-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10a1 1 0 01-1-1V4a1 1 0 011-1h7a1 1 0 011 1v5a1 1 0 01-1 1h-1" />
                          </svg>
                          <span>Ver 480p</span>
                        </button>
                        
                        <button
                          onClick={async () => {
                            try {
                              const downloadUrl = await videoApi.getDownloadUrl(video.id, 'low');
                              window.open(downloadUrl, '_blank');
                            } catch (error) {
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 px-2 rounded-lg transition-colors flex items-center justify-center space-x-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                          <span>Baixar 480p</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-sm text-gray-400">
            Mostrando <span className="font-semibold text-gray-300">{(page - 1) * limit + 1}</span> a{' '}
            <span className="font-semibold text-gray-300">{Math.min(page * limit, total)}</span> de{' '}
            <span className="font-semibold text-gray-300">{total}</span> vídeos
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Anterior</span>
            </button>
            
            <div className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium min-w-[80px] text-center">
              {page} de {totalPages}
            </div>
            
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors flex items-center space-x-2"
            >
              <span className="hidden sm:inline">Próxima</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        fileName={videoToDelete?.fileName || ''}
        isDeleting={videoToDelete ? deletingVideos.has(videoToDelete.id) : false}
      />
    </div>
  );
};