import { Resend } from "resend";
import { env } from "../config/env.js";
const client = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
/** Delivers email through Resend. Without an API key, logs the content instead (development). */
export async function sendEmail(message) {
    if (!client) {
        console.log(`[email] ${message.subject} -> ${message.to}\n${message.text ?? message.html}`);
        return { id: "dev", logged: true };
    }
    const result = await client.emails.send({
        from: env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
    });
    if (result.error) {
        throw new Error(`Resend failed: ${result.error.message}`);
    }
    return { id: result.data?.id ?? "unknown" };
}
