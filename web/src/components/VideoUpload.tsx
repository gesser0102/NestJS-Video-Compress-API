import React, { useState, useRef } from 'react';
import { videoApi } from '../services/api';

interface VideoUploadProps {
  onUploadComplete: (videoId: string) => void;
  onVideoProcessing: (videoId: string, fileName: string) => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: string;
  videoId?: string;
  error?: string;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ onUploadComplete, onVideoProcessing }) => {
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(new Map());
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setGlobalError(null);
    
    // Supported video types matching backend configuration
    const supportedTypes = [
      'video/mp4',
      'video/webm', 
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/x-flv',
      'video/3gpp',
      'video/x-m4v',
      'video/x-ms-wmv',
      'video/mpeg'
    ];
    
    // Process each selected file
    Array.from(files).forEach(file => {
      if (!supportedTypes.includes(file.type)) {
        setGlobalError(prev => prev ? prev + `\n${file.name}: Formato não suportado. Use: MP4, WebM, MOV, AVI, MKV, FLV, 3GP, M4V, WMV, MPG, MPEG` : `${file.name}: Formato não suportado. Use: MP4, WebM, MOV, AVI, MKV, FLV, 3GP, M4V, WMV, MPG, MPEG`);
        return;
      }

      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        setGlobalError(prev => prev ? prev + `\n${file.name}: Deve ter no máximo 500MB` : `${file.name}: Deve ter no máximo 500MB`);
        return;
      }

      uploadFile(file);
    });
  };

  const uploadFile = async (file: File) => {
    const fileId = `${file.name}-${Date.now()}`;
    
    // Add file to uploading files map
    setUploadingFiles(prev => new Map(prev).set(fileId, {
      file,
      progress: 0,
      status: 'Iniciando upload...'
    }));

    try {
      const uploadResponse = await videoApi.generateUploadUrl(file.name, file.type);
      
      // Update status
      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        const fileData = newMap.get(fileId);
        if (fileData) {
          newMap.set(fileId, {
            ...fileData,
            status: 'Enviando vídeo para o storage...',
            videoId: uploadResponse.videoId
          });
        }
        return newMap;
      });
      
      await videoApi.uploadToSignedUrl(
        uploadResponse.signedUrl,
        file,
        (progress) => {
          setUploadingFiles(prev => {
            const newMap = new Map(prev);
            const fileData = newMap.get(fileId);
            if (fileData) {
              newMap.set(fileId, {
                ...fileData,
                progress: Math.round(progress),
                status: `Enviando... ${Math.round(progress)}%`
              });
            }
            return newMap;
          });
        }
      );

      // Update to completed
      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        const fileData = newMap.get(fileId);
        if (fileData) {
          newMap.set(fileId, {
            ...fileData,
            progress: 100,
            status: 'Upload concluído!'
          });
        }
        return newMap;
      });
      
      // Notificar servidor que upload foi concluído para iniciar processamento
      await videoApi.notifyUploadComplete(uploadResponse.videoId);
      
      // Notificar que o vídeo está sendo processado
      onVideoProcessing(uploadResponse.videoId, file.name);
      
      // Notify completion and remove from uploading list after delay
      setTimeout(() => {
        setUploadingFiles(prev => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });
        onUploadComplete(uploadResponse.videoId);
      }, 2000);
      
    } catch (err) {
      
      // Update file with error
      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        const fileData = newMap.get(fileId);
        if (fileData) {
          newMap.set(fileId, {
            ...fileData,
            progress: 0,
            status: 'Falha no upload',
            error: 'Falha no upload. Tente novamente.'
          });
        }
        return newMap;
      });
      
      // Remove failed file after some time
      setTimeout(() => {
        setUploadingFiles(prev => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });
      }, 5000);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        files.forEach(file => dt.items.add(file));
        input.files = dt.files;
        handleFileSelect({ target: input } as any);
      }
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  return (
    <div className="w-full">
      <div
        className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-gray-500 transition-colors bg-gray-800"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {uploadingFiles.size > 0 ? (
          <div className="space-y-6">
            {/* Header com animação */}
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center mb-4">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-3 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-1">
                Enviando {uploadingFiles.size} vídeo{uploadingFiles.size > 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-gray-400">
                Processamento iniciará automaticamente após o upload
              </p>
            </div>
            
            {/* Lista de arquivos com design moderno */}
            <div className="space-y-4 max-h-72 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600">
              {Array.from(uploadingFiles.entries()).map(([fileId, fileData]) => (
                <div key={fileId} className="group relative">
                  {/* Card principal */}
                  <div className={`relative bg-gradient-to-br ${
                    fileData.error 
                      ? 'from-red-900/30 to-red-800/20 border-red-700/50' 
                      : fileData.progress === 100
                        ? 'from-green-900/30 to-green-800/20 border-green-700/50'
                        : 'from-blue-900/30 to-blue-800/20 border-blue-700/50'
                  } border rounded-xl p-4 backdrop-blur-sm transition-all duration-300`}>
                    
                    {/* Header do arquivo */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${
                          fileData.error ? 'bg-red-500/20' : fileData.progress === 100 ? 'bg-green-500/20' : 'bg-blue-500/20'
                        } flex items-center justify-center`}>
                          {fileData.error ? (
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : fileData.progress === 100 ? (
                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate" title={fileData.file.name}>
                            {fileData.file.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {(fileData.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                      
                      {/* Percentage badge */}
                      <div className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${
                        fileData.error 
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : fileData.progress === 100
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {fileData.error ? 'Erro' : `${fileData.progress}%`}
                      </div>
                    </div>
                    
                    {/* Barra de progresso moderna */}
                    <div className="mb-3">
                      <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-700 ease-out relative ${
                            fileData.error 
                              ? 'bg-gradient-to-r from-red-500 to-red-600'
                              : fileData.progress === 100
                                ? 'bg-gradient-to-r from-green-500 to-green-600'
                                : 'bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600'
                          }`}
                          style={{ width: `${Math.max(2, fileData.progress)}%` }}
                        >
                          {!fileData.error && fileData.progress > 0 && fileData.progress < 100 && (
                            <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-medium ${
                        fileData.error ? 'text-red-300' : fileData.progress === 100 ? 'text-green-300' : 'text-blue-300'
                      }`}>
                        {fileData.error || fileData.status}
                      </p>
                      
                      {!fileData.error && fileData.progress > 0 && fileData.progress < 100 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* Shimmer effect para upload ativo */}
                    {!fileData.error && fileData.progress > 0 && fileData.progress < 100 && (
                      <div className="absolute inset-0 rounded-xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-shimmer"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl transform transition-transform duration-300 hover:scale-110 hover:rotate-3">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-2">Arraste seus vídeos aqui</div>
              <div className="text-gray-400 mb-1">ou clique para selecionar múltiplos arquivos</div>
              <div className="text-xs text-gray-500">Upload múltiplo com processamento paralelo</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.webm,.mov,.avi,.mkv,.flv,.3gp,.m4v,.wmv,.mpg,.mpeg,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/x-flv,video/3gpp,video/x-m4v,video/x-ms-wmv,video/mpeg"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group relative bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 text-white px-8 py-3.5 rounded-xl hover:from-blue-700 hover:via-blue-800 hover:to-purple-800 transition-all duration-300 font-semibold shadow-2xl hover:shadow-blue-500/25 transform hover:scale-105 hover:-translate-y-0.5"
            >
              <span className="relative z-10 flex items-center space-x-2">
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span>Selecionar Vídeos</span>
              </span>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
            </button>
          </div>
        )}
      </div>

      {globalError && (
        <div className="mt-4 p-3 bg-red-900 border border-red-600 text-red-300 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-medium">Erros nos arquivos:</div>
              <div className="text-sm mt-1 whitespace-pre-line">{globalError}</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="flex items-center space-x-2 text-gray-300">
          <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span>MP4, WebM, MOV, AVI, MKV, FLV, 3GP, M4V, WMV, MPG, MPEG</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-300">
          <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            </svg>
          </div>
          <span>Até 500MB por arquivo</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-300">
          <div className="w-5 h-5 bg-purple-500/20 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span>Upload múltiplo simultâneo</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-300">
          <div className="w-5 h-5 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span>Processamento paralelo</span>
        </div>
      </div>
    </div>
  );
};