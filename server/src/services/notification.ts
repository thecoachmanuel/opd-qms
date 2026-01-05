
// Simulated Notification Service
// In a real app, this would integrate with Twilio, SendGrid, etc.

export const NotificationService = {
    sendSMS: async (phone: string, message: string) => {
        console.log(`[SMS SIMULATION] To: ${phone} | Message: ${message}`);
        // Simulate API latency
        // await new Promise(resolve => setTimeout(resolve, 500));
        return true;
    },

    sendEmail: async (email: string, subject: string, body: string) => {
        console.log(`[EMAIL SIMULATION] To: ${email} | Subject: ${subject}`);
        console.log(`[EMAIL BODY]: ${body}`);
        return true;
    }
};
