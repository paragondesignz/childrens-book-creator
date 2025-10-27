'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface BookPage {
  pageNumber: number;
  pageText: string | null;
  imageUrl: string | null;
  type: 'text' | 'image' | 'cover';
}

interface DigitalBookViewerProps {
  title: string;
  childName: string;
  pages: BookPage[];
}

export function DigitalBookViewer({ title, childName, pages }: DigitalBookViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay) return;

    const timer = setInterval(() => {
      setCurrentPage((prev) => {
        if (prev >= pages.length - 1) {
          setAutoPlay(false);
          return prev;
        }
        return prev + 1;
      });
    }, 5000); // 5 seconds per page

    return () => clearInterval(timer);
  }, [autoPlay, pages.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        goToNextPage();
      } else if (e.key === 'ArrowLeft') {
        goToPrevPage();
      } else if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, pages.length]);

  // Touch gestures for swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNextPage();
    } else if (isRightSwipe) {
      goToPrevPage();
    }
  };

  const goToNextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const page = pages[currentPage];

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {/* Main Viewer */}
      <div
        className="relative w-full h-full flex items-center justify-center"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setShowControls(true)}
        onClick={() => setShowControls(!showControls)}
      >
        {/* Page Content */}
        <div className="relative w-full h-full max-w-4xl max-h-[90vh] flex items-center justify-center">
          {page.type === 'cover' || page.imageUrl ? (
            // Image page (full-bleed)
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {page.imageUrl && (
                <Image
                  src={page.imageUrl}
                  alt={`Page ${page.pageNumber}`}
                  fill
                  className="object-contain"
                  priority={currentPage === 0}
                />
              )}
            </div>
          ) : (
            // Text page (white background with centered text)
            <div className="relative w-full h-full bg-white flex items-center justify-center p-16">
              <div className="max-w-2xl text-center">
                <p className="text-2xl md:text-3xl font-serif leading-relaxed text-gray-800">
                  {page.pageText}
                </p>
                {page.pageNumber > 0 && (
                  <p className="mt-8 text-sm text-gray-400">{page.pageNumber}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Arrows */}
        {showControls && (
          <>
            {currentPage > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevPage();
                }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white p-4 rounded-full shadow-lg transition-all z-10"
                aria-label="Previous page"
              >
                <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {currentPage < pages.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextPage();
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white p-4 rounded-full shadow-lg transition-all z-10"
                aria-label="Next page"
              >
                <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      {/* Top Controls */}
      {showControls && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 z-20">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="text-white">
              <h1 className="text-xl font-bold">{title}</h1>
              <p className="text-sm text-gray-300">Starring {childName}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAutoPlay(!autoPlay)}
                className={`p-2 rounded-lg transition ${
                  autoPlay ? 'bg-primary text-white' : 'bg-white/90 text-gray-800'
                }`}
                title={autoPlay ? 'Stop auto-play' : 'Auto-play'}
              >
                {autoPlay ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-white/90 hover:bg-white rounded-lg transition"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Progress Bar */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 z-20">
          <div className="max-w-6xl mx-auto">
            {/* Page thumbnails / dots */}
            <div className="flex items-center justify-center gap-2 mb-2">
              {pages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx)}
                  className={`transition-all ${
                    idx === currentPage
                      ? 'w-3 h-3 bg-white rounded-full'
                      : 'w-2 h-2 bg-white/50 rounded-full hover:bg-white/70'
                  }`}
                  aria-label={`Go to page ${idx + 1}`}
                />
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/30 rounded-full h-1">
              <div
                className="bg-white h-1 rounded-full transition-all duration-300"
                style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
              />
            </div>

            {/* Page counter */}
            <p className="text-center text-white text-sm mt-2">
              Page {currentPage + 1} of {pages.length}
            </p>
          </div>
        </div>
      )}

      {/* Instructions overlay (shown on first page) */}
      {currentPage === 0 && showControls && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-white/90 rounded-lg p-4 shadow-lg z-30 max-w-md text-center">
          <p className="text-sm text-gray-700 font-medium mb-2">
            Swipe or use arrow keys to navigate
          </p>
          <p className="text-xs text-gray-600">
            Tap anywhere to hide controls • Space or → to advance
          </p>
        </div>
      )}
    </div>
  );
}
