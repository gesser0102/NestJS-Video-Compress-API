import React, { useState, useEffect } from 'react';
import { VideoUpload } from '../components/VideoUpload';
import { VideoList } from '../components/VideoList';
import { ModernHeader } from '../components/ModernHeader';
import { socketService } from '../services/socket';

export const HomePage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [processingVideos, setProcessingVideos] = useState<Array<{ videoId: string; fileName: string }>>([]);
  const [videoCount, setVideoCount] = useState(0);

  useEffect(() => {
    socketService.connect();
    
    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleVideoProcessing = (videoId: string, fileName: string) => {
    setProcessingVideos(prev => [...prev, { videoId, fileName }]);
    
    // Fallback: remove após 15 segundos se não foi detectado na lista
    setTimeout(() => {
      setProcessingVideos(prev => prev.filter(v => v.videoId !== videoId));
    }, 15000);
  };

  const handleVideoAppeared = (videoId: string) => {
    // Remove imediatamente quando o vídeo aparece na lista principal
    setProcessingVideos(prev => prev.filter(v => v.videoId !== videoId));
  };

  const handleVideoCountChange = (count: number) => {
    setVideoCount(count);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <ModernHeader videoCount={videoCount} />

      <main className="max-w-full mx-auto px-6 py-8">
        {/* Upload Section */}
        <div className="mb-8">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 text-white flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload de Vídeo
            </h2>
            <VideoUpload onUploadComplete={handleUploadComplete} onVideoProcessing={handleVideoProcessing} />
          </div>
        </div>

        {/* Video List Section */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <VideoList 
            refreshTrigger={refreshTrigger} 
            processingVideos={processingVideos} 
            onVideoAppeared={handleVideoAppeared}
            onVideoCountChange={handleVideoCountChange}
          />
        </div>
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 mt-16">
        <div className="max-w-full mx-auto px-6 py-6">
          <div className="text-center text-gray-400">
            <p>Plataforma desenvolvida com NestJS, Firebase, Google Cloud Storage e React</p>
          </div>
        </div>
      </footer>
    </div>
  );
};