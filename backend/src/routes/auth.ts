import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../server';
import { AppError } from '../middleware/errorHandler';
import { isDisposableEmail } from '../lib/disposable-domains';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAdminNewSignupNotification,
} from '../services/emailService';

export const authRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function signToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    // Block disposable/temp emails
    if (isDisposableEmail(email)) {
      throw new AppError('Disposable email addresses are not allowed. Please use a permanent email.', 422);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Email already in use', 409);

    const hashed = await bcrypt.hash(password, 12);
    const verificationToken = generateToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        emailVerified: false,
        verificationToken,
        verificationTokenExpiry,
      },
    });

    await prisma.userSettings.create({ data: { userId: user.id } });

    // Send verification/welcome email (fire-and-forget)
    sendVerificationEmail(email, verificationToken, name).catch((err) =>
      console.error('[FYI Guard] Failed to send verification email:', err),
    );

    // Notify admin about new signup (fire-and-forget)
    sendAdminNewSignupNotification(email, name).catch((err) =>
      console.error('[FYI Guard] Failed to send admin notification:', err),
    );

    res.status(201).json({
      message: 'Account created. Please check your email to verify your account before logging in.',
      userId: user.id,
      email: user.email,
      emailVerified: false,
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /verify-email
// ---------------------------------------------------------------------------
authRouter.get('/verify-email', async (req, res, next) => {
  try {
    const token = req.query.token as string;
    if (!token) throw new AppError('Verification token is required', 400);

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) throw new AppError('Invalid or expired verification link. Please request a new one.', 400);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    // Return a simple HTML success page
    res.send(`
      <!DOCTYPE html>
      <html><head><title>Email Verified - FYI Guard</title>
      <style>body{font-family:'Outfit',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f3f4f6;margin:0}
      .card{background:#fff;border-radius:16px;padding:48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:440px}
      .icon{font-size:64px;margin-bottom:16px}h1{color:#368F4D;margin:0 0 12px}p{color:#6b7280;line-height:1.6}
      </style></head><body>
      <div class="card"><div class="icon">&#10003;</div><h1>Email Verified!</h1>
      <p>Your FYI Guard account is now active. You can close this page and sign in from the extension.</p></div>
      </body></html>
    `);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /resend-verification
// ---------------------------------------------------------------------------
authRouter.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = resendVerificationSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether user exists
      res.json({ message: 'If an account with that email exists, a new verification link has been sent.' });
      return;
    }

    if (user.emailVerified) {
      res.json({ message: 'Email is already verified. You can sign in.' });
      return;
    }

    const verificationToken = generateToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiry },
    });

    sendVerificationEmail(email, verificationToken, user.name ?? undefined).catch((err) =>
      console.error('[FYI Guard] Failed to resend verification email:', err),
    );

    res.json({ message: 'If an account with that email exists, a new verification link has been sent.' });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /login  (blocks unverified users)
// ---------------------------------------------------------------------------
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError('Invalid credentials', 401);
    }

    // Block unverified users
    if (!user.emailVerified) {
      throw new AppError(
        'Please verify your email before signing in. Check your inbox for the verification link.',
        403,
      );
    }

    const token = signToken(user.id, user.role);
    res.json({ token, userId: user.id, email: user.email, role: user.role });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /forgot-password
// ---------------------------------------------------------------------------
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
      return;
    }

    const resetToken = generateToken();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    sendPasswordResetEmail(email, resetToken).catch((err) =>
      console.error('[FYI Guard] Failed to send password reset email:', err),
    );

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /reset-password
// ---------------------------------------------------------------------------
authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) throw new AppError('Invalid or expired reset token. Please request a new one.', 400);

    const hashed = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetToken: null,
        resetTokenExpiry: null,
        // Also verify email if not yet verified (they proved email ownership)
        emailVerified: true,
      },
    });

    res.json({ message: 'Password has been reset successfully. You can now sign in.' });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /reset-password  (HTML form for browser)
// ---------------------------------------------------------------------------
authRouter.get('/reset-password', async (req, res) => {
  const token = req.query.token as string;
  res.send(`
    <!DOCTYPE html>
    <html><head><title>Reset Password - FYI Guard</title>
    <style>body{font-family:'Outfit',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f3f4f6;margin:0}
    .card{background:#fff;border-radius:16px;padding:48px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:440px;width:100%}
    h1{color:#368F4D;margin:0 0 8px;font-size:22px}p{color:#6b7280;margin:0 0 24px}
    input{width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:12px;font-family:inherit}
    button{width:100%;padding:12px;background:#368F4D;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
    button:hover{background:#2d7a40}.msg{padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px;display:none}
    .msg.ok{background:#D1FAE5;color:#065F46;display:block}.msg.err{background:#FEE2E2;color:#DC2626;display:block}
    </style></head><body>
    <div class="card"><h1>Reset Password</h1><p>Enter your new password below.</p>
    <div id="msg" class="msg"></div>
    <form id="f" onsubmit="return handleReset(event)">
      <input type="password" id="pw" placeholder="New password (min 8 characters)" minlength="8" required>
      <input type="password" id="pw2" placeholder="Confirm new password" minlength="8" required>
      <button type="submit">Reset Password</button>
    </form></div>
    <script>
    async function handleReset(e){e.preventDefault();var pw=document.getElementById('pw').value,pw2=document.getElementById('pw2').value,msg=document.getElementById('msg');
    if(pw!==pw2){msg.className='msg err';msg.textContent='Passwords do not match';return false}
    try{var r=await fetch('/api/v1/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'${token || ''}',password:pw})});
    var d=await r.json();if(r.ok){msg.className='msg ok';msg.textContent=d.message||'Password reset!';document.getElementById('f').style.display='none'}
    else{msg.className='msg err';msg.textContent=d.message||'Reset failed'}}catch(err){msg.className='msg err';msg.textContent='Network error'}return false}
    </script></body></html>
  `);
});

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------
authRouter.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});