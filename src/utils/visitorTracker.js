/**
 * visitorTracker.js
 * Tracks app visitors in real-time with Geolocation, Device info, Source, and Timestamp.
 * Saves into Firestore collection 'visitorLogs' so Admin can see who opened the link.
 */

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase'
import { getSession } from './auth'

const VISITOR_ID_KEY = 'stt_visitor_id'
const SESSION_LOGGED_KEY = 'stt_visit_logged_at'
const THROTTLE_MS = 10 * 60 * 1000 // Log once per 10 minutes per browser session to prevent duplicates

/**
 * Generate or get persistent visitor ID
 */
function getOrCreateVisitorId() {
  try {
    let vid = localStorage.getItem(VISITOR_ID_KEY)
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
      localStorage.setItem(VISITOR_ID_KEY, vid)
    }
    return vid
  } catch {
    return 'v_unknown'
  }
}

/**
 * Parse client device and browser information
 */
function getDeviceInfo() {
  const ua = navigator.userAgent || ''
  let os = 'Unknown OS'
  let deviceType = 'Desktop'
  let browser = 'Browser'

  // Device & OS detection
  if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'Tablet'
  } else if (/iPhone|Android|Mobile/i.test(ua)) {
    deviceType = 'Mobile'
  }

  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'macOS'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Linux/i.test(ua)) os = 'Linux'

  // Browser detection
  // Extract brand/model hint if available in UA
  let model = ''
  const androidModelMatch = ua.match(/;\s*([^;)]+)\s+Build\//)
  if (androidModelMatch) {
    model = androidModelMatch[1].trim()
  }

  return { os, deviceType, browser, userAgent: ua, model }
}

/**
 * Detect traffic source / referrer
 */
function getTrafficSource() {
  try {
    // Check URL query parameters (e.g. ?ref=status or ?source=instagram)
    const params = new URLSearchParams(window.location.search)
    const refParam = params.get('ref') || params.get('source') || params.get('utm_source')
    if (refParam) return refParam

    const ref = document.referrer ? document.referrer.toLowerCase() : ''
    if (!ref) return 'Direct / Link Click'

    if (ref.includes('instagram.com')) return 'Instagram'
    if (ref.includes('whatsapp') || ref.includes('wa.me')) return 'WhatsApp'
    if (ref.includes('t.me') || ref.includes('telegram')) return 'Telegram'
    if (ref.includes('youtube.com') || ref.includes('youtu.be')) return 'YouTube'
    if (ref.includes('google.')) return 'Google Search'
    if (ref.includes('facebook.com')) return 'Facebook'
    if (ref.includes('linkedin.com')) return 'LinkedIn'

    return new URL(ref).hostname || 'Other Link'
  } catch {
    return 'Direct Link'
  }
}

/**
 * Fetch IP Geolocation (City, State, Country, ISP) using ipwho.is
 */
async function fetchGeolocation() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500) // 3.5s timeout

    const res = await fetch('https://ipwho.is/', { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error('Geo failed')

    const data = await res.json()
    if (!data.success) throw new Error('Geo not success')

    return {
      ip: data.ip || '',
      city: data.city || 'Unknown City',
      region: data.region || '',
      country: data.country || 'India',
      countryCode: data.country_code || 'IN',
      countryEmoji: data.flag?.emoji || '🇮🇳',
      isp: data.connection?.isp || data.connection?.org || '',
      timezone: data.timezone?.id || 'Asia/Kolkata',
    }
  } catch (err) {
    return {
      ip: '',
      city: 'India',
      region: '',
      country: 'India',
      countryCode: 'IN',
      countryEmoji: '🇮🇳',
      isp: '',
      timezone: 'Asia/Kolkata',
    }
  }
}

/**
 * Automatically record a visitor visit in Firestore
 */
export async function trackVisitor() {
  try {
    // Check session throttle
    const lastLogged = sessionStorage.getItem(SESSION_LOGGED_KEY)
    if (lastLogged && Date.now() - Number(lastLogged) < THROTTLE_MS) {
      return
    }

    const visitorId = getOrCreateVisitorId()
    const session = getSession()
    const username = session?.username || 'Guest Visitor'
    const displayName = session?.displayName || ''
    const { os, deviceType, browser, userAgent, model } = getDeviceInfo()
    const source = getTrafficSource()
    const geo = await fetchGeolocation()

    const logData = {
      visitorId,
      username,
      displayName,
      isLoggedIn: Boolean(session?.username),
      deviceType,
      os,
      browser,
      model: model || '',
      userAgent: userAgent || '',
      source,
      landingPage: window.location.pathname || '/',
      screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      ...geo,
      timestamp: Date.now(),
      createdAt: serverTimestamp(),
    }

    await addDoc(collection(db, 'visitorLogs'), logData)
    sessionStorage.setItem(SESSION_LOGGED_KEY, Date.now().toString())
  } catch (err) {
    console.debug('Visitor track notice:', err?.message)
  }
}

/**
 * Real-time listener for visitor logs (Admin View)
 * @param {Function} callback - Receives array of visitor log objects
 */
export function subscribeToVisitorLogs(callback) {
  try {
    const q = query(
      collection(db, 'visitorLogs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    )

    return onSnapshot(
      q,
      (snapshot) => {
        const logs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        callback(logs)
      },
      (err) => {
        console.error('Visitor logs error:', err)
      }
    )
  } catch (err) {
    console.error('subscribeToVisitorLogs error:', err)
    return () => {}
  }
}
