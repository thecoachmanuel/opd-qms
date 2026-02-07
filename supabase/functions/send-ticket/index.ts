import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketRequest {
  email: string;
  fullName: string;
  ticketCode: string;
  scheduledTime: string;
  clinicName: string;
  checkInUrl: string;
}

const transporter = nodemailer.createTransport({
  host: Deno.env.get("SMTP_HOST"),
  port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
  auth: {
    user: Deno.env.get("SMTP_USER"),
    pass: Deno.env.get("SMTP_PASS"),
  },
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, fullName, ticketCode, scheduledTime, clinicName, checkInUrl } = await req.json() as TicketRequest;

    const dateStr = new Date(scheduledTime).toLocaleString('en-US', { 
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
          .header { background-color: #16a34a; padding: 20px; text-align: center; color: white; }
          .content { padding: 30px; text-align: center; }
          .ticket-code { font-size: 36px; font-weight: bold; color: #16a34a; margin: 20px 0; letter-spacing: 2px; }
          .details { text-align: left; background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .details p { margin: 8px 0; color: #374151; }
          .label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; }
          .value { font-size: 16px; font-weight: 500; }
          .btn { display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
          .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;">Appointment Confirmed</h1>
          </div>
          <div class="content">
            <p style="color: #4b5563; font-size: 16px;">Hello <strong>${fullName}</strong>,</p>
            <p style="color: #6b7280;">Your appointment at <strong>${clinicName}</strong> has been successfully booked.</p>
            
            <div class="ticket-code">${ticketCode}</div>
            
            <div class="details">
              <p><span class="label">Date & Time</span><br><span class="value">${dateStr}</span></p>
              <p><span class="label">Clinic</span><br><span class="value">${clinicName}</span></p>
              <p><span class="label">Patient Name</span><br><span class="value">${fullName}</span></p>
            </div>

            <p style="color: #6b7280; margin-bottom: 20px;">Please arrive 15 minutes early. Present this ticket code or scan the QR code at the check-in kiosk.</p>
            
            <a href="${checkInUrl}" class="btn">View Ticket & Check In</a>
          </div>
          <div class="footer">
            <p>LASUTH Queue Management System</p>
            <p>1-5 Oba Akinjobi Way, Ikeja, Lagos State</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: Deno.env.get("SMTP_FROM") || '"LASUTH QMS" <noreply@lasuth.com>',
      to: email,
      subject: `Appointment Confirmed: ${ticketCode}`,
      html: html,
    });

    return new Response(JSON.stringify(info), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
