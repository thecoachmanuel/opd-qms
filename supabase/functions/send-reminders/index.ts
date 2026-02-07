import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const transporter = nodemailer.createTransport({
  host: Deno.env.get("SMTP_HOST"),
  port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
  auth: {
    user: Deno.env.get("SMTP_USER"),
    pass: Deno.env.get("SMTP_PASS"),
  },
});

serve(async (req) => {
  try {
    // 1. Get appointments for tomorrow (next 24-30 hours range to be safe)
    // Actually, simple logic: > now AND < now + 24h AND notify_email = true AND reminder_sent = false
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
        *,
        patients (full_name, email),
        clinics (name)
      `)
      .eq("notify_email", true)
      .eq("reminder_sent", false)
      .eq("status", "booked")
      .gt("scheduled_time", now.toISOString())
      .lt("scheduled_time", tomorrow.toISOString());

    if (error) throw error;

    if (!appointments || appointments.length === 0) {
      return new Response(JSON.stringify({ message: "No reminders to send" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const results = [];

    // 2. Send emails
    for (const app of appointments) {
      if (!app.patients?.email) continue;

      const dateStr = new Date(app.scheduled_time).toLocaleString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background-color: #eab308; padding: 20px; text-align: center; color: white; }
            .content { padding: 30px; text-align: center; }
            .ticket-code { font-size: 36px; font-weight: bold; color: #eab308; margin: 20px 0; letter-spacing: 2px; }
            .details { text-align: left; background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .details p { margin: 8px 0; color: #374151; }
            .label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; }
            .value { font-size: 16px; font-weight: 500; }
            .btn { display: inline-block; background-color: #eab308; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
            .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;">Appointment Reminder</h1>
            </div>
            <div class="content">
              <p style="color: #4b5563; font-size: 16px;">Hello <strong>${app.patients.full_name}</strong>,</p>
              <p style="color: #6b7280;">This is a reminder for your upcoming appointment at <strong>${app.clinics?.name}</strong>.</p>
              
              <div class="ticket-code">${app.ticket_code}</div>
              
              <div class="details">
                <p><span class="label">Date & Time</span><br><span class="value">${dateStr}</span></p>
                <p><span class="label">Clinic</span><br><span class="value">${app.clinics?.name}</span></p>
              </div>

              <p style="color: #6b7280; margin-bottom: 20px;">Please arrive 15 minutes early.</p>
            </div>
            <div class="footer">
              <p>LASUTH Queue Management System</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await transporter.sendMail({
          from: Deno.env.get("SMTP_FROM") || '"LASUTH QMS" <noreply@lasuth.com>',
          to: app.patients.email,
          subject: `Reminder: Appointment ${app.ticket_code}`,
          html: html,
        });

        // 3. Mark as sent
        await supabase
          .from("appointments")
          .update({ reminder_sent: true })
          .eq("id", app.id);

        results.push({ id: app.id, status: "sent" });
      } catch (err) {
        console.error(`Failed to send reminder for ${app.id}:`, err);
        results.push({ id: app.id, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
