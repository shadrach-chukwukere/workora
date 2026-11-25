import { sendEmail } from "./email.js";

interface User {
  email: string;
  name: string;
}

function htmlWrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;background:#f4f6fb;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a2e}
.wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)}
.header{background:#0f172a;padding:24px 32px}
.header h1{color:#fff;margin:0;font-size:18px;font-weight:700}
.header span{color:#94a3b8;font-size:13px}
.body{padding:32px}
.body p{margin:0 0 16px;line-height:1.6;font-size:14px;color:#374151}
.btn{display:inline-block;padding:12px 24px;background:#4f7cff;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;margin:8px 0 16px}
.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#9ca3af;border-top:1px solid #f1f5f9}
</style>
</head>
<body>
<div class="wrap">
  <div class="header"><h1>Workora</h1><span>Find your next great collaboration.</span></div>
  <div class="body">${body}</div>
  <div class="footer">You received this email because you have an account on Workora. &copy; 2026 Workora.</div>
</div>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendProposalReceivedEmail(client: User, freelancerName: string, projectTitle: string, proposalUrl: string) {
  await sendEmail({
    to: client.email,
    subject: `New proposal on "${projectTitle}" — Workora`,
    html: htmlWrap(`
      <p>Hi ${esc(client.name)},</p>
      <p><strong>${esc(freelancerName)}</strong> submitted a proposal on your project <strong>"${esc(projectTitle)}"</strong>.</p>
      <p>Review their cover letter and bid, then shortlist or accept to get started.</p>
      <a class="btn" href="${esc(proposalUrl)}">Review Proposal</a>
      <p>You can manage all proposals from your client dashboard.</p>
    `),
    text: `Hi ${client.name}, ${freelancerName} submitted a proposal on "${projectTitle}". Visit Workora to review it.`,
  });
}

export async function sendProposalAcceptedEmail(freelancer: User, projectTitle: string, contractUrl: string) {
  await sendEmail({
    to: freelancer.email,
    subject: `🎉 Your proposal was accepted — Workora`,
    html: htmlWrap(`
      <p>Hi ${esc(freelancer.name)},</p>
      <p>Great news! Your proposal for <strong>"${esc(projectTitle)}"</strong> was accepted by the client.</p>
      <p>Your contract is now active. Head to your workspace to view the contract details and add milestones.</p>
      <a class="btn" href="${esc(contractUrl)}">View Contract</a>
    `),
    text: `Hi ${freelancer.name}, your proposal for "${projectTitle}" was accepted. Visit Workora to view your contract.`,
  });
}

export async function sendProposalShortlistedEmail(freelancer: User, projectTitle: string, proposalUrl: string) {
  await sendEmail({
    to: freelancer.email,
    subject: `Your proposal was shortlisted — Workora`,
    html: htmlWrap(`
      <p>Hi ${esc(freelancer.name)},</p>
      <p>Your proposal for <strong>"${esc(projectTitle)}"</strong> has been shortlisted by the client.</p>
      <p>They are reviewing candidates — hang tight while they make a decision.</p>
      <a class="btn" href="${esc(proposalUrl)}">View Proposal</a>
    `),
    text: `Hi ${freelancer.name}, your proposal for "${projectTitle}" was shortlisted on Workora.`,
  });
}

export async function sendMilestoneSubmittedEmail(client: User, milestoneTitle: string, projectTitle: string, contractUrl: string) {
  await sendEmail({
    to: client.email,
    subject: `Milestone ready for review — Workora`,
    html: htmlWrap(`
      <p>Hi ${esc(client.name)},</p>
      <p>The freelancer submitted <strong>"${esc(milestoneTitle)}"</strong> for review on your contract for <strong>"${esc(projectTitle)}"</strong>.</p>
      <p>Review the deliverables and either approve the milestone or request a revision.</p>
      <a class="btn" href="${esc(contractUrl)}">Review Milestone</a>
    `),
    text: `Hi ${client.name}, milestone "${milestoneTitle}" on "${projectTitle}" is ready for your review on Workora.`,
  });
}

export async function sendMilestonePaidEmail(freelancer: User, milestoneTitle: string, netMinor: number, currency: string, contractUrl: string) {
  const amount = (netMinor / 100).toLocaleString("en-US", { style: "currency", currency: currency || "USD" });
  await sendEmail({
    to: freelancer.email,
    subject: `💰 Milestone paid — ${amount} — Workora`,
    html: htmlWrap(`
      <p>Hi ${esc(freelancer.name)},</p>
      <p>The client approved and paid milestone <strong>"${esc(milestoneTitle)}"</strong>.</p>
      <p>You received <strong>${esc(amount)}</strong> (after platform fee). The funds are reflected in your earnings.</p>
      <a class="btn" href="${esc(contractUrl)}">View Contract</a>
    `),
    text: `Hi ${freelancer.name}, milestone "${milestoneTitle}" was paid. You received ${amount} on Workora.`,
  });
}

export async function sendRevisionRequestedEmail(freelancer: User, milestoneTitle: string, note: string, contractUrl: string) {
  await sendEmail({
    to: freelancer.email,
    subject: `Revision requested — Workora`,
    html: htmlWrap(`
      <p>Hi ${esc(freelancer.name)},</p>
      <p>The client requested a revision on <strong>"${esc(milestoneTitle)}"</strong>.</p>
      <p><strong>Note from client:</strong> ${esc(note)}</p>
      <a class="btn" href="${esc(contractUrl)}">View &amp; Resubmit</a>
    `),
    text: `Hi ${freelancer.name}, revision requested on "${milestoneTitle}": ${note}. Visit Workora to resubmit.`,
  });
}

export async function sendProjectInviteEmail(
  freelancer: User,
  clientName: string,
  projectTitle: string,
  message: string,
  inboxUrl: string,
) {
  await sendEmail({
    to: freelancer.email,
    subject: `${clientName} invited you to "${projectTitle}" — Workora`,
    html: htmlWrap(`
      <p>Hi ${esc(freelancer.name)},</p>
      <p><strong>${esc(clientName)}</strong> invited you to submit a proposal on <strong>"${esc(projectTitle)}"</strong>.</p>
      ${message ? `<p><strong>Message:</strong> ${esc(message)}</p>` : ""}
      <a class="btn" href="${esc(inboxUrl)}">View Invitation</a>
      <p>You can accept the invitation and send a proposal from your Workora workspace.</p>
    `),
    text: `Hi ${freelancer.name}, ${clientName} invited you to "${projectTitle}" on Workora. ${message}`,
  });
}

export async function sendContractCompletedEmail(user: User, projectTitle: string, dashboardUrl: string) {
  await sendEmail({
    to: user.email,
    subject: `Contract completed — Workora`,
    html: htmlWrap(`
      <p>Hi ${esc(user.name)},</p>
      <p>Your contract for <strong>"${esc(projectTitle)}"</strong> has been marked as completed. 🎉</p>
      <p>Don't forget to leave a review for your collaboration partner — it helps the community!</p>
      <a class="btn" href="${esc(dashboardUrl)}">Leave a Review</a>
    `),
    text: `Hi ${user.name}, contract for "${projectTitle}" is complete. Leave a review on Workora.`,
  });
}
