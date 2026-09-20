import React, { useState, useRef } from "react"
import {
  PRESET_WALLPAPERS,
  compressCustomImage,
  clearWallpaper,
} from "../utils/wallpaperStorage"

export default function BackgroundModal({
  isOpen,
  onClose,
  userName,
  currentWallpaper,
  wallpaperConfig,
  onSelectWallpaper,
  onUpdateConfig,
  onResetDefault,
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError("")
    setIsUploading(true)

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File size exceeds 10MB limit")
      }

      // Compress client-side to responsive ~1600px JPEG to fit localStorage cleanly
      const compressedDataUrl = await compressCustomImage(file, 1600, 0.82)
      onSelectWallpaper(compressedDataUrl)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (err) {
      setUploadError(err.message || "Failed to process image")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    setUploadError("")
    setIsUploading(true)

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File size exceeds 10MB limit")
      }
      const compressedDataUrl = await compressCustomImage(file, 1600, 0.82)
      onSelectWallpaper(compressedDataUrl)
    } catch (err) {
      setUploadError(err.message || "Failed to process image")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#121217] border border-[#232330] rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#20202d] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🖼️</span>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
              Choose Background
            </h2>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 select-none custom-scrollbar">
          {/* 1. Custom Upload Area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <span>📤</span> Upload Custom Background
              </span>
              <span className="text-[11px] text-gray-400">Personal to your device</span>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-[#2b3044] hover:border-cyan-500/60 bg-[#161824]/60 hover:bg-[#1a1d2e] rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                ☁️
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-gray-200 group-hover:text-cyan-300 transition-colors">
                  {isUploading ? "Optimizing image..." : "Click to upload or drag & drop"}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Static: JPG, PNG, WEBP, GIF (Max 10MB)
                </p>
              </div>
            </div>

            {uploadError && (
              <p className="text-xs text-red-400 mt-1.5 px-1">⚠️ {uploadError}</p>
            )}
          </div>

          {/* 2. Wallpaper Controls (Screen Fit & Focus Darkness) */}
          <div className="bg-[#171722] border border-[#262638] rounded-2xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <span>🔲</span> Wallpaper Display Settings
              </span>
            </div>

            {/* Screen Fit Toggle */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Screen Fit:</span>
              <div className="inline-flex p-0.5 rounded-lg bg-[#111118] border border-[#2b2b3a]">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ fit: "cover" })}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    wallpaperConfig.fit === "cover"
                      ? "bg-cyan-600 text-white font-bold shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Fill Screen
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ fit: "contain" })}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    wallpaperConfig.fit === "contain"
                      ? "bg-cyan-600 text-white font-bold shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Fit (No Crop)
                </button>
              </div>
            </div>

            {/* Focus Darkness / Dimming Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-gray-400">Focus Darkness Overlay:</span>
                <span className="font-mono font-bold text-cyan-300">
                  {Math.round((wallpaperConfig.dim ?? 0.45) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.15"
                max="0.85"
                step="0.05"
                value={wallpaperConfig.dim ?? 0.45}
                onChange={(e) => onUpdateConfig({ dim: parseFloat(e.target.value) })}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-[#252535] rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>Brighter (15%)</span>
                <span>Darker / High Contrast (85%)</span>
              </div>
            </div>

            {/* Soft Blur Toggle */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#252535]">
              <span className="text-gray-400">Soft Focus Blur:</span>
              <button
                type="button"
                onClick={() => onUpdateConfig({ blur: !wallpaperConfig.blur })}
                className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                  wallpaperConfig.blur
                    ? "bg-purple-600/30 border-purple-500 text-purple-200 font-bold"
                    : "bg-[#111118] border-[#2b2b3a] text-gray-400 hover:text-white"
                }`}
              >
                {wallpaperConfig.blur ? "✓ Blur On (Distraction-Free)" : "Blur Off (Crisp)"}
              </button>
            </div>
          </div>

          {/* 3. Preset Wallpapers Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <span>✨</span> Preset Wallpapers
              </span>
              <button
                type="button"
                onClick={onResetDefault}
                className="px-2.5 py-1 rounded-lg bg-[#1e1e2a] hover:bg-[#2d2d3e] border border-[#2f2f42] text-[11px] font-semibold text-gray-300 hover:text-white transition-all flex items-center gap-1"
                title="Reset to minimalist default deep dark"
              >
                <span>↺</span> Reset to Default
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PRESET_WALLPAPERS.map((preset) => {
                const isSelected = currentWallpaper === preset.url
                return (
                  <div
                    key={preset.id}
                    onClick={() => onSelectWallpaper(preset.url)}
                    className={`relative rounded-xl overflow-hidden aspect-video cursor-pointer border-2 transition-all hover:scale-[1.02] group ${
                      isSelected
                        ? "border-cyan-400 ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-500/20"
                        : "border-[#262638] hover:border-gray-500"
                    }`}
                  >
                    <img
                      src={preset.thumb}
                      alt={preset.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Dark gradient for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2">
                      <span className="text-[11px] font-semibold text-white truncate leading-tight">
                        {preset.title}
                      </span>
                    </div>

                    {/* Selected badge */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 bg-cyan-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-md flex items-center gap-0.5">
                        <span>✓</span> Active
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#20202d] bg-[#0e0e13] flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
          <span>Changes apply instantly & stay on your device</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
