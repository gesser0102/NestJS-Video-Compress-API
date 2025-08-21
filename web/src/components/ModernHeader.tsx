import React, { useState, useEffect } from 'react';
import { socketService } from '../services/socket';

interface ModernHeaderProps {
  videoCount?: number;
}

export const ModernHeader: React.FC<ModernHeaderProps> = ({ videoCount = 0 }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Check initial status
    setIsWebSocketConnected(socketService.isConnected());

    // Listen to connection changes
    const handleConnectionChange = (connected: boolean) => {
      setIsWebSocketConnected(connected);
    };

    socketService.onConnectionChange(handleConnectionChange);

    return () => {
      socketService.offConnectionChange(handleConnectionChange);
    };
  }, []);

  return (
    <header 
      className={`
        sticky top-0 z-50 transition-all duration-500 ease-in-out
        ${isScrolled 
          ? 'bg-gray-900/95 backdrop-blur-md border-b border-gray-700/50 shadow-2xl' 
          : 'bg-gradient-to-br from-gray-900 via-purple-900/20 to-blue-900/20'
        }
      `}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-full blur-3xl animate-spin-slow"></div>
      </div>

      <div className="relative max-w-full mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          {/* Logo and Title Section */}
          <div className="flex items-center space-x-4">
            {/* Logo */}
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-blue-400 rounded-xl blur-sm opacity-75"></div>
                <div className="relative w-full h-full flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Title and Subtitle */}
            <div className="space-y-1">
              <h1 className="header-title font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                Video Platform
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${
                    isWebSocketConnected 
                      ? 'bg-green-400 animate-pulse' 
                      : 'bg-red-400 animate-pulse'
                  }`}></div>
                  <span>{isWebSocketConnected ? 'Sistema Online' : 'Sistema Offline'}</span>
                </div>
                <span className="text-gray-500">•</span>
                <span>{videoCount} vídeos processados</span>
              </div>
            </div>
          </div>

          {/* Right Section - Stats and Time */}
          <div className="flex items-center space-x-3 md:space-x-4">
            {/* Processing Indicator */}
            <div className="flex items-center space-x-2 bg-gray-800/50 backdrop-blur-sm rounded-full px-3 md:px-4 py-2 border border-gray-700/50">
              <div className="relative">
                <div className={`w-3 h-3 rounded-full ${
                  isWebSocketConnected 
                    ? 'bg-green-500 animate-ping' 
                    : 'bg-red-500 animate-ping'
                } absolute`}></div>
                <div className={`w-3 h-3 rounded-full ${
                  isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
              </div>
              <span className="text-sm text-gray-300 hidden sm:inline">
                {isWebSocketConnected ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Time Display */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-full px-3 md:px-4 py-2 border border-gray-700/50">
              <div className="text-xs md:text-sm font-mono text-gray-300">
                {currentTime.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: false 
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Subtitle with animation - Hidden when scrolled */}
        <div className={`mt-4 overflow-hidden transition-all duration-300 ease-in-out ${
          isScrolled ? 'opacity-0 -translate-y-2 h-0' : 'opacity-100 translate-y-0 h-auto'
        }`}>
          <p className="text-gray-400 animate-fade-in-up pb-2" style={{ animationDelay: '0.2s' }}>
            Upload, processamento e gerenciamento de vídeos em tempo real com tecnologia de ponta
          </p>
        </div>

      </div>
    </header>
  );
};