const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const Settings = require('../models/Settings');
  const settings = await Settings.findOne();
  if (settings && settings.isEmailEnabled === false) {
    console.log('Email services are globally disabled in Settings. Skipping email to:', options.email || options.to);
    return { skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
    port: process.env.EMAIL_PORT || process.env.SMTP_PORT,
    secure: (process.env.EMAIL_PORT || process.env.SMTP_PORT) == 465,
    auth: {
      user: process.env.EMAIL_USER || process.env.SMTP_EMAIL,
      pass: process.env.EMAIL_PASS || process.env.SMTP_PASSWORD,
    },
  });

  const fromName = process.env.FROM_NAME || "APEX Club";
  const fromEmail = process.env.FROM_EMAIL || process.env.EMAIL_USER || process.env.SMTP_EMAIL;

  const message = {
    from: `"${fromName}" <${fromEmail}>`,
    to: options.email || options.to, 
    bcc: options.bcc, // Added BCC support for privacy
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const info = await transporter.sendMail(message);

  console.log('Message sent: %s', info.messageId);
  return info;
};

module.exports = sendEmail;
