// functions/src/index.ts
//
// This file previously hosted `dailyEmailCampaigns`, a scheduled Cloud Function
// that sent onboarding and re-engagement email through Gmail SMTP using the
// deprecated `functions.config()` API.
//
// It has been retired. Those drips are now authored journeys in the marketing
// system (see docs/MARKETING.md and scripts/seed-journeys.ts), which is a
// strict improvement in every respect that matters:
//
//   - it honours marketing consent and unsubscribes, which this did not;
//   - it shares one weekly frequency cap with every other send, so an
//     automation and a broadcast cannot double up on the same athlete;
//   - the copy is editable in the admin console rather than compiled in;
//   - opens, clicks and unsubscribes are attributed per campaign;
//   - it sends through the authenticated hybridx.club domain via Brevo rather
//     than a Gmail account.
//
// Running both systems would have meant two independent schedules mailing the
// same athletes the same nudges, with no shared suppression list between them.
//
// The file is kept (rather than deleted) so `firebase deploy --only functions`
// has something to deploy: deploying an empty function set is what actually
// removes the old scheduled function and its Cloud Scheduler job. Once that
// deploy has run, this file and the functions/ directory can be removed
// entirely if nothing else needs them.

export {};
