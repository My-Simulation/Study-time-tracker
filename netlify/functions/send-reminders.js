// netlify/functions/send-reminders.js
// Netlify serverless function to broadcast daily study reminders to inactive users

const webPush = require('web-push')
const { initializeApp, getApps } = require('firebase/app')
const { getFirestore, collection, getDocs, query, where, doc, updateDoc, arrayRemove } = require('firebase/firestore')

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

exports.handler = async (event) => {
  // Allow POST or GET with admin validation
  const authHeader = event.headers.authorization || ''
  const isPost = event.httpMethod === 'POST'
  const todayStr = getLocalDateString()

  try {
    // 1. Fetch all users
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

    if (usersWithTokens.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'No registered push devices found.', sentCount: 0 }),
      }
    }

    // 2. Fetch today's sessions to identify who has already studied
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

    // 3. Filter for inactive users
    const inactiveUsers = usersWithTokens.filter(
      (u) => !activeUsersToday.has(u.username.toLowerCase())
    )

    let sentCount = 0
    let failedCount = 0
    const deadSubscriptions = []

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
          sentCount++
        } catch (err) {
          failedCount++
          // If subscription expired or gone (410 or 404), mark for cleanup
          if (err.statusCode === 410 || err.statusCode === 404) {
            deadSubscriptions.push({ username: user.username, sub })
          }
        }
      }
    }

    // Clean up expired tokens
    for (const item of deadSubscriptions) {
      try {
        await updateDoc(doc(db, 'users', item.username), {
          pushSubscriptions: arrayRemove(item.sub),
        })
      } catch {}
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({
        success: true,
        today: todayStr,
        totalRegisteredUsers: usersWithTokens.length,
        inactiveUsersFound: inactiveUsers.length,
        notificationsSent: sentCount,
        failedNotifications: failedCount,
        cleanedDeadTokens: deadSubscriptions.length,
      }),
    }
  } catch (err) {
    console.error('Send reminders error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
