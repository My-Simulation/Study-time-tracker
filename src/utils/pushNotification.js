/**
 * pushNotification.js
 * Web Push Notification manager using W3C PushManager + VAPID.
 * Handles client-side subscription and syncs push tokens with Firestore.
 */

import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export const VAPID_PUBLIC_KEY = 'BLDLxPPeudzs6kWQRqOwvHp1D7p5qI6M-tLRtS40H53JnHVZ6dD_oGNX2D0YS6hO37TVGwnWGTHpNWMRAirZY80'

/**
 * Converts a base64 string to a Uint8Array for PushManager subscription.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Checks if Push Notifications are supported on this device/browser.
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Returns current browser permission: 'default' | 'granted' | 'denied'
 */
export function getPushPermissionState() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Checks if the current user already has active push enabled.
 */
export async function isUserSubscribedToPush(username) {
  if (!isPushSupported() || !username) return false
  if (Notification.permission !== 'granted') return false

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return Boolean(sub)
  } catch (err) {
    console.warn('Error checking existing subscription:', err)
    return false
  }
}

/**
 * Requests notification permission, subscribes the device via PushManager,
 * and saves the push endpoint & keys to Firestore under `users/{username}`.
 */
export async function subscribeUserToPush(username) {
  if (!isPushSupported()) {
    throw new Error('Push Notifications are not supported in this browser.')
  }
  if (!username) {
    throw new Error('User must be logged in to enable push reminders.')
  }

  // 1. Request permission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notification permission was denied. Please allow notifications from your browser site settings.'
        : 'Notification permission was dismissed.'
    )
  }

  // 2. Ensure Service Worker is active
  const reg = await navigator.serviceWorker.ready
  if (!reg.pushManager) {
    throw new Error('PushManager not available on ServiceWorker.')
  }

  // 3. Check existing subscription or create new
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey,
    })
  }

  const subJson = sub.toJSON()
  const cleanUsername = username.trim().toLowerCase()

  // 4. Save to Firestore users collection
  try {
    const userRef = doc(db, 'users', cleanUsername)
    await updateDoc(userRef, {
      pushSubscription: subJson,
      pushSubscriptions: arrayUnion(subJson),
      pushEnabled: true,
      pushUpdatedAt: serverTimestamp(),
      lastDeviceUserAgent: navigator.userAgent || 'unknown',
    })
  } catch (err) {
    console.error('Failed to sync push subscription with Firestore:', err)
  }

  // Save local flag
  try {
    localStorage.setItem(`stt_push_enabled_${cleanUsername}`, 'true')
  } catch {}

  // 5. Fire a welcoming local confirmation notification
  try {
    if (reg.showNotification) {
      await reg.showNotification('🎉 JeetPrep Reminders Active!', {
        body: 'Daily Study Reminders aur Streak Alerts ab aapke phone par aayenge. Consistent raho!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'jeetprep-welcome',
      })
    }
  } catch {}

  return subJson
}

/**
 * Unsubscribes the current device from Push Notifications.
 */
export async function unsubscribeUserFromPush(username) {
  if (!isPushSupported()) return false

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const subJson = sub.toJSON()
      await sub.unsubscribe()

      if (username) {
        const cleanUsername = username.trim().toLowerCase()
        const userRef = doc(db, 'users', cleanUsername)
        await updateDoc(userRef, {
          pushSubscriptions: arrayRemove(subJson),
          pushEnabled: false,
          pushUpdatedAt: serverTimestamp(),
        }).catch(() => {})
        localStorage.removeItem(`stt_push_enabled_${cleanUsername}`)
      }
      return true
    }
  } catch (err) {
    console.warn('Error unsubscribing:', err)
  }
  return false
}

/**
 * Triggers an instant test notification directly on the user's phone.
 */
export async function sendTestNotification(username) {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    throw new Error('Notifications are not permitted.')
  }
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('⚡ JeetPrep Study Alert (Test)', {
    body: `${username ? `${username}, a` : 'A'}apka daily study reminder ready hai! Focus on your goals today.`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'jeetprep-test',
  })
}
