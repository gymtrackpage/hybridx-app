"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyEmailCampaigns = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const generated_templates_1 = require("./generated-templates");
admin.initializeApp();
const db = admin.firestore();
// --- Configuration ---
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: functions.config().gmail.email,
        pass: functions.config().gmail.password,
    },
});
const SENDER_NAME = "HybridX Training";
const EMAIL_TEMPLATES = {
    day1: generated_templates_1.day1,
    day3: generated_templates_1.day3,
    day7: generated_templates_1.day7,
    day14: generated_templates_1.day14,
    reEngagement: generated_templates_1.reEngagement
};
// --- Helper: Send Email ---
async function sendEmail(to, subject, html) {
    try {
        await transporter.sendMail({
            from: `"${SENDER_NAME}" <${functions.config().gmail.email}>`,
            to,
            subject,
            html,
        });
        return true;
    }
    catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        return false;
    }
}
// --- Scheduled Function ---
exports.dailyEmailCampaigns = functions.pubsub
    .schedule("every day 10:00")
    .timeZone("Europe/London") // UK time
    .onRun(async (context) => {
    const now = new Date();
    // Calculate windows for each day (strictly checking "started X days ago")
    const getWindow = (daysAgo) => {
        const start = new Date(now.getTime() - (daysAgo + 1) * 24 * 60 * 60 * 1000); // 24h window
        const end = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        return { start, end };
    };
    const w1 = getWindow(1);
    const w3 = getWindow(3);
    const w7 = getWindow(7);
    const w14 = getWindow(14);
    // Re-engagement window (e.g., users who joined 5 days ago and are inactive)
    const wReEngage = getWindow(5);
    const usersRef = db.collection("users");
    const sentCounts = { day1: 0, day3: 0, day7: 0, day14: 0, reEngage: 0 };
    // --- Process Day 1 (Welcome / First Workout) ---
    const usersDay1 = await usersRef
        .where("trialStartDate", ">=", admin.firestore.Timestamp.fromDate(w1.start))
        .where("trialStartDate", "<=", admin.firestore.Timestamp.fromDate(w1.end))
        .get();
    for (const doc of usersDay1.docs) {
        const u = doc.data();
        if (u.email) {
            await sendEmail(u.email, "Day 1: Let's Get Started!", EMAIL_TEMPLATES.day1);
            sentCounts.day1++;
        }
    }
    // --- Process Day 3 (AI Coach) ---
    const usersDay3 = await usersRef
        .where("trialStartDate", ">=", admin.firestore.Timestamp.fromDate(w3.start))
        .where("trialStartDate", "<=", admin.firestore.Timestamp.fromDate(w3.end))
        .get();
    for (const doc of usersDay3.docs) {
        const u = doc.data();
        if (u.email) {
            await sendEmail(u.email, "Day 3: Meet Your AI Coach", EMAIL_TEMPLATES.day3);
            sentCounts.day3++;
        }
    }
    // --- Process Day 7 (Progress) ---
    const usersDay7 = await usersRef
        .where("trialStartDate", ">=", admin.firestore.Timestamp.fromDate(w7.start))
        .where("trialStartDate", "<=", admin.firestore.Timestamp.fromDate(w7.end))
        .get();
    for (const doc of usersDay7.docs) {
        const u = doc.data();
        if (u.email) {
            await sendEmail(u.email, "Day 7: Track Your Progress", EMAIL_TEMPLATES.day7);
            sentCounts.day7++;
        }
    }
    // --- Process Day 14 (Advanced Features) ---
    const usersDay14 = await usersRef
        .where("trialStartDate", ">=", admin.firestore.Timestamp.fromDate(w14.start))
        .where("trialStartDate", "<=", admin.firestore.Timestamp.fromDate(w14.end))
        .get();
    for (const doc of usersDay14.docs) {
        const u = doc.data();
        if (u.email) {
            await sendEmail(u.email, "Day 14: Level Up Your Training", EMAIL_TEMPLATES.day14);
            sentCounts.day14++;
        }
    }
    // --- Process Re-Engagement (Day 5, check for inactivity) ---
    const usersReEngage = await usersRef
        .where("trialStartDate", ">=", admin.firestore.Timestamp.fromDate(wReEngage.start))
        .where("trialStartDate", "<=", admin.firestore.Timestamp.fromDate(wReEngage.end))
        .get();
    for (const doc of usersReEngage.docs) {
        const u = doc.data();
        if (u.email) {
            // Check for activity
            const sessions = await db.collection("workoutSessions")
                .where("userId", "==", doc.id)
                .limit(1)
                .get();
            if (sessions.empty) {
                // Since your re-engagement email uses {{name}}, we must replace it.
                // The generated-templates file has the raw string with {{name}}.
                let html = EMAIL_TEMPLATES.reEngagement;
                if (html) {
                    html = html.replace("{{name}}", u.firstName || "Athlete");
                    await sendEmail(u.email, "We miss you at HybridX!", html);
                    sentCounts.reEngage++;
                }
            }
        }
    }
    console.log(`Email Campaign Run:`, sentCounts);
    return null;
});
//# sourceMappingURL=index.js.map