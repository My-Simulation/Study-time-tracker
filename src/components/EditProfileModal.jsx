/**
 * EditProfileModal.jsx — Edit profile modal
 * Allows changing:
 * - Profile photo (upload, resize to compact base64, remove)
 * - Avatar color
 * - Display Name
 * - Username (enforces 4+ characters, uniqueness check, and data migration)
 */

import React, { useState, useRef } from 'react'
import {
  validateUsername,
  isUsernameTaken,
  updateUserProfile,
  changeUsername,
} from '../utils/firestoreHelpers'
import { updateCurrentSession } from '../utils/auth'

const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#dc2626',
  '#d97706', '#db2777', '#0891b2', '#65a30d',
]

export default function EditProfileModal({
  isOpen,
  onClose,
  currentUser,
  userData,
  onUpdated,
}) {
  if (!isOpen) return null

  const fileInputRef = useRef(null)

  const [displayName, setDisplayName] = useState(userData?.displayName || currentUser || '')
  const [username, setUsername] = useState(currentUser || '')
  const [avatarColor, setAvatarColor] = useState(userData?.avatarColor || '#7c3aed')
  const [photoUrl, setPhotoUrl] = useState(userData?.photoUrl || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Handle image file upload & compression ────────────────────────────────
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP).')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        // Resize to square max 256x256 for fast loading & minimal footprint
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 256
        let width = img.width
        let height = img.height

        // Center crop to square
        const minSide = Math.min(width, height)
        const sx = (width - minSide) / 2
        const sy = (height - minSide) / 2

        canvas.width = MAX_SIZE
        canvas.height = MAX_SIZE

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, MAX_SIZE, MAX_SIZE)

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setPhotoUrl(compressedDataUrl)
        setError('')
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setPhotoUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Save all changes ──────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e?.preventDefault()
    setError('')
    setSuccess('')
    const trimmedUser = username.trim().toLowerCase()
    const trimmedDisplay = displayName.trim()

    // 1. Validate username
    const userErr = validateUsername(trimmedUser)
    if (userErr) {
      setError(userErr)
      return
    }

    setLoading(true)

    try {
      let activeUsername = currentUser.toLowerCase()
      let updatedDoc = null

      // 2. If username changed, migrate username and data
      if (trimmedUser !== currentUser.toLowerCase()) {
        const changeResult = await changeUsername(currentUser, trimmedUser)
        if (!changeResult.ok) {
          setError(changeResult.error)
          setLoading(false)
          return
        }
        activeUsername = trimmedUser
        updatedDoc = changeResult.userDoc
      }

      // 3. Update profile fields
      updatedDoc = await updateUserProfile(activeUsername, {
        displayName: trimmedDisplay || activeUsername,
        avatarColor,
        photoUrl,
      })

      // 4. Update session storage
      updateCurrentSession({
        username: activeUsername,
        displayName: trimmedDisplay || activeUsername,
        avatarColor,
        photoUrl,
      })

      setSuccess('Profile updated successfully! ✅')
      setTimeout(() => {
        if (onUpdated) onUpdated(updatedDoc, activeUsername)
        onClose()
      }, 700)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError('Could not update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-3xl max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">✏️</span>
            <h3 className="text-base font-bold text-white">Edit Profile</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#202020] text-gray-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* ── Photo & Avatar Section ── */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative group">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black text-white border-2 border-[#333] shadow-lg overflow-hidden flex-shrink-0"
              style={{ background: avatarColor }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (username[0] || 'U').toUpperCase()
              )}
            </div>

            {/* Quick change camera button overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity backdrop-blur-xs"
            >
              📷 Change
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold px-3 py-1 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 transition-colors"
            >
              Upload Photo
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30 transition-colors"
              >
                Remove Photo
              </button>
            )}
          </div>

          {/* Avatar Color Picker (Used as fallback or background) */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400">Badge Color:</span>
            <div className="flex items-center gap-1.5">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    avatarColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Edit Form ── */}
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Display Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              maxLength={30}
              className="w-full rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm px-3.5 py-2.5 outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300">Username</label>
              <span className="text-[10px] text-gray-500">Min. 4 characters</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  setError('')
                }}
                placeholder="new_username"
                maxLength={20}
                className="w-full rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm pl-8 pr-3.5 py-2.5 outline-none focus:border-purple-500 transition-colors font-mono"
              />
            </div>
            {username.trim() && username.trim().length < 4 && (
              <p className="text-[10px] text-amber-400">Username must be at least 4 characters long.</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 rounded-xl bg-green-950/40 border border-green-900/50 text-green-300 text-xs">
              {success}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2.5 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#202020] text-gray-300 text-xs font-bold hover:bg-[#282828] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim() || username.trim().length < 4}
              className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                opacity: loading || !username.trim() || username.trim().length < 4 ? 0.5 : 1,
                cursor: loading || !username.trim() || username.trim().length < 4 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
