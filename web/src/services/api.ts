import axios from 'axios';
import type { VideoProcessing, UploadUrlResponse, VideoListResponse } from '../types/video';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const videoApi = {
  async generateUploadUrl(fileName: string, contentType: string): Promise<UploadUrlResponse> {
    const response = await api.post<UploadUrlResponse>('/api/videos/upload-url', {
      fileName,
      contentType,
    });
    return response.data;
  },

  async uploadToSignedUrl(signedUrl: string, file: File, onProgress?: (progress: number) => void): Promise<void> {
    await axios.put(signedUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
  },

  async getVideos(
    page: number = 1,
    limit: number = 20,
  ): Promise<VideoListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await api.get<VideoListResponse>(`/api/videos?${params}`);
    return response.data;
  },

  async getVideoById(id: string): Promise<VideoProcessing> {
    const response = await api.get<VideoProcessing>(`/api/videos/${id}`);
    return response.data;
  },

  async notifyUploadComplete(videoId: string): Promise<void> {
    await api.post(`/api/videos/${videoId}/upload-complete`);
  },

  async getDownloadUrl(videoId: string, quality: 'original' | 'low' = 'low'): Promise<string> {
    const response = await api.get<{ downloadUrl: string }>(`/api/videos/${videoId}/download?quality=${quality}`);
    return response.data.downloadUrl;
  },

  async getViewUrl(videoId: string, quality: 'original' | 'low' = 'low'): Promise<string> {
    const response = await api.get<{ viewUrl: string }>(`/api/videos/${videoId}/view?quality=${quality}`);
    return response.data.viewUrl;
  },

  async getThumbnailUrl(videoId: string): Promise<string> {
    const response = await api.get<{ thumbnailUrl: string }>(`/api/videos/${videoId}/thumbnail`);
    return response.data.thumbnailUrl;
  },

  async deleteVideo(videoId: string): Promise<void> {
    await api.delete(`/api/videos/${videoId}`);
  },

};