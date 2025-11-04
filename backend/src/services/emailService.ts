import { sendEmail } from '../config/email';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const sendWelcomeEmail = async (email: string, name: string): Promise<void> => {
  const subject = 'Welcome to Project Planner!';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Project Planner!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Thank you for joining Project Planner! We're excited to have you on board.</p>
            <p>With Project Planner, you can:</p>
            <ul>
              <li>Create and manage projects with your team</li>
              <li>Visualize project timelines with Gantt charts</li>
              <li>Track task dependencies and schedules</li>
              <li>Collaborate in real-time with team members</li>
            </ul>
            <a href="${FRONTEND_URL}/dashboard" class="button">Get Started</a>
          </div>
          <div class="footer">
            <p>© 2025 Project Planner. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail(email, subject, html);
};

export const sendOTPEmail = async (email: string, otp: string): Promise<void> => {
  const subject = 'Password Reset OTP - Project Planner';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; margin: 20px 0; border-radius: 5px; }
          .warning { color: #e74c3c; font-size: 14px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>You have requested to reset your password.</p>
            <p>Use the following OTP (One-Time Password) to reset your password:</p>
            <div class="otp-box">${otp}</div>
            <p class="warning">⚠️ This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2025 Project Planner. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail(email, subject, html);
};

export const sendTeamInvitationEmail = async (
  email: string,
  teamName: string,
  inviterName: string,
  token: string
): Promise<void> => {
  const acceptUrl = `${FRONTEND_URL}/invitations/accept?token=${token}`;
  const rejectUrl = `${FRONTEND_URL}/invitations/reject?token=${token}`;

  const subject = `You're invited to join ${teamName} on Project Planner`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .team-name { font-size: 24px; font-weight: bold; color: #667eea; margin: 20px 0; }
          .buttons { text-align: center; margin: 30px 0; }
          .button { display: inline-block; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 0 10px; font-weight: bold; }
          .accept { background: #10b981; color: white; }
          .reject { background: #ef4444; color: white; }
          .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Team Invitation</h1>
          </div>
          <div class="content">
            <p><strong>${inviterName}</strong> has invited you to join:</p>
            <div class="team-name">${teamName}</div>
            <p>Join the team to collaborate on projects, manage tasks, and track progress together!</p>
            <div class="buttons">
              <a href="${acceptUrl}" class="button accept">Accept Invitation</a>
              <a href="${rejectUrl}" class="button reject">Decline</a>
            </div>
            <p style="font-size: 12px; color: #888;">This invitation will expire in 7 days.</p>
          </div>
          <div class="footer">
            <p>© 2025 Project Planner. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail(email, subject, html);
};

export const sendTaskAssignmentEmail = async (
  email: string,
  taskName: string,
  projectName: string,
  assignerName: string
): Promise<void> => {
  const subject = `New Task Assigned: ${taskName}`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .task-info { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Task Assigned</h1>
          </div>
          <div class="content">
            <p><strong>${assignerName}</strong> has assigned you a new task:</p>
            <div class="task-info">
              <p><strong>Task:</strong> ${taskName}</p>
              <p><strong>Project:</strong> ${projectName}</p>
            </div>
            <a href="${FRONTEND_URL}/dashboard" class="button">View Task</a>
          </div>
          <div class="footer">
            <p>© 2025 Project Planner. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail(email, subject, html);
};

