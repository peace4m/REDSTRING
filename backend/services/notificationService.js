/**
 * RedString — Notification Service (Firebase FCM)
 * ==================================================
 * Sends push notifications to mobile and web clients.
 *
 * Used for:
 *  - Lab timer completions ("DNA results are in")
 *  - Friend invites to a War Room
 *  - Case twist events (if app is backgrounder)
 *  - Room member activity
 *
 * Install: npm install firebase-admin
 */

const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
    if (initialized) return;
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId:   process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
    initialized = true;
}

/**
 * Send a push notification to one or more FCM tokens.
 *
 * @param {string[]} tokens   - FCM device tokens
 * @param {string}   title    - Notification title
 * @param {string}   body     - Notification body
 * @param {object}   data     - Custom data payload (key-value strings)
 */
async function sendPushNotification(tokens, title, body, data = {}) {
    try {
        initFirebase();
        if (!tokens || tokens.length === 0) return;

        // Convert all data values to strings (FCM requirement)
        const stringData = Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
        );

        const message = {
            notification: { title, body },
            data:         stringData,
            android: {
                notification: {
                    sound:    'default',
                    priority: 'high',
                    // Custom notification channel for lab results
                    channelId: data.type === 'lab_result' ? 'lab_results' : 'default',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
        };

        if (tokens.length === 1) {
            // Single token
            message.token = tokens[0];
            const response = await admin.messaging().send(message);
            console.log(`[FCM] Sent to 1 device: ${response}`);
        } else {
            // Multiple tokens (multicast)
            const multicastMessage = { ...message, tokens };
            delete multicastMessage.token;
            const response = await admin.messaging().sendEachForMulticast(multicastMessage);
            console.log(`[FCM] Multicast: ${response.successCount} success, ${response.failureCount} failed`);

            // Remove invalid tokens from DB
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && (
                    resp.error?.code === 'messaging/invalid-registration-token' ||
                    resp.error?.code === 'messaging/registration-token-not-registered'
                )) {
                    invalidTokens.push(tokens[idx]);
                }
            });
            if (invalidTokens.length > 0) {
                await removeInvalidTokens(invalidTokens);
            }
        }
    } catch (err) {
        console.error('[FCM] Send failed:', err.message);
        // Don't throw — notification failure should never break game flow
    }
}

async function removeInvalidTokens(tokens) {
    const User = require('../../schema/user.schema');
    await User.updateMany(
        { fcmTokens: { $in: tokens } },
        { $pullAll: { fcmTokens: tokens } }
    );
}

/**
 * Predefined notification templates
 */
const NOTIFICATIONS = {
    labResult: (label) => ({
        title: `🔬 Lab Results In`,
        body:  `${label} — results are ready. Check your case files.`,
    }),
    roomInvite: (fromName, caseTitle) => ({
        title: `🕵️ ${fromName} invites you`,
        body:  `Join the investigation: ${caseTitle}`,
    }),
    twistFired: (twistTitle) => ({
        title: `⚡ Case Update`,
        body:  `New development: ${twistTitle}`,
    }),
    memberJoined: (name, roomCode) => ({
        title: `👤 ${name} joined`,
        body:  `${name} has joined your War Room (${roomCode})`,
    }),
};

module.exports = { sendPushNotification, NOTIFICATIONS };