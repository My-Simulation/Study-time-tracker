/**
 * scripts/send-reminders.mjs
 * Standalone script to send push reminders to inactive users.
 * Can be run with: node scripts/send-reminders.mjs
 */

import webPush from 'web-push'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, arrayRemove } from 'firebase/firestore'

const VAPID_PUBLIC_KEY = 'BLDLxPPeudzs6kWQRqOwvHp1D7p5qI6M-tLRtS40H53JnHVZ6dD_oGNX2D0YS6hO37TVGwnWGTHpNWMRAirZY80'
const VAPID_PRIVATE_KEY = 'LODkSppWYx9q9lXMQ2h_6qRLvyG90Nie8VqCbFv10SA'

webPush.setVapidDetails(
  'mailto:support@jeetprep.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

const firebaseConfig = {
  apiKey: 'AIzaSyCqwdwxpR8X9qqCCG696m2jiQ0qHzdznk0',
  authDomain: 'study-time-tracker-321c4.firebaseapp.com',
  projectId: 'study-time-tracker-321c4',
  storageBucket: 'study-time-tracker-321c4.firebasestorage.app',
  messagingSenderId: '271980708508',
  appId: '1:271980708508:web:9c9788fe706185339e2359',
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getFirestore(app)

function getLocalDateString() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function run() {
  console.log('⚡ Checking JeetPrep users for inactive study reminders...')
  const todayStr = getLocalDateString()
  console.log(`📅 Target date: ${todayStr}`)

  const usersSnap = await getDocs(collection(db, 'users'))
  const usersWithTokens = []

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data()
    const subs = data.pushSubscriptions || (data.pushSubscription ? [data.pushSubscription] : [])
    if (subs && subs.length > 0) {
      usersWithTokens.push({
        username: docSnap.id,
        displayName: data.displayName || docSnap.id,
        subscriptions: subs,
      })
    }
  })

  console.log(`👥 Total users with registered push devices: ${usersWithTokens.length}`)
  if (usersWithTokens.length === 0) {
    console.log('No registered devices found. When users click "Turn On Reminders", their devices will register here.')
    process.exit(0)
  }

  const sessionsSnap = await getDocs(
    query(collection(db, 'sessions'), where('date', '==', todayStr))
  )
  const activeUsersToday = new Set()
  sessionsSnap.forEach((docSnap) => {
    const s = docSnap.data()
    if (s.userName && Number(s.totalSeconds) > 0) {
      activeUsersToday.add(s.userName.toLowerCase())
    }
  })

  const inactiveUsers = usersWithTokens.filter(
    (u) => !activeUsersToday.has(u.username.toLowerCase())
  )

  console.log(`⚠️ Inactive users today: ${inactiveUsers.length}`)

  let sent = 0
  let failed = 0
  for (const user of inactiveUsers) {
    const name = user.displayName || `@${user.username}`
    const payload = JSON.stringify({
      title: `⚠️ Streak Khatre Me Hai! Padhai start karein`,
      body: `${name}, aapne aaj apna timer use nahi kara! Daily time table ready karo aur JeetPrep ke sath apne aim tak pahuncho.`,
      url: '/',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'jeetprep-daily-inactive-reminder',
    })

    for (const sub of user.subscriptions) {
      try {
        await webPush.sendNotification(sub, payload)
        console.log(`✓ Sent notification to @${user.username}`)
        sent++
      } catch (err) {
        console.error(`✗ Failed for @${user.username}:`, err.message)
        failed++
      }
    }
  }

  console.log(`\n🎉 Summary: Sent ${sent} notifications, ${failed} failed.`)
  process.exit(0)
}

run().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
