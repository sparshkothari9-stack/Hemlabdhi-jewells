const { URLSearchParams } = require('url');

function getProvider() {
  return (process.env.OTP_PROVIDER || '').trim().toLowerCase();
}

function shouldShowDemoOtp() {
  return process.env.NODE_ENV !== 'production' || process.env.SHOW_DEMO_OTP === 'true';
}

function digitsOnly(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function toE164(phone) {
  const raw = String(phone || '').trim();
  if (raw.startsWith('+')) return `+${digitsOnly(raw)}`;
  const digits = digitsOnly(raw);
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

function toMsg91Mobile(phone) {
  const digits = digitsOnly(phone);
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function sendTwilioOtp(phone, code, ttlMinutes) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken || (!from && !messagingServiceSid)) {
    throw new Error('Twilio OTP is not fully configured');
  }

  const body = new URLSearchParams({
    To: toE164(phone),
    Body: `Your Hem Labdhi jewels OTP is ${code}. It expires in ${ttlMinutes} minutes.`
  });
  if (messagingServiceSid) {
    body.set('MessagingServiceSid', messagingServiceSid);
  } else {
    body.set('From', from);
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio OTP failed: ${text.slice(0, 200)}`);
  }
}

async function sendMsg91Otp(phone, code) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const otpVar = process.env.MSG91_OTP_VAR || 'var1';

  if (!authKey || !templateId) {
    throw new Error('MSG91 OTP is not fully configured');
  }

  const response = await fetch('https://api.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      authkey: authKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      template_id: templateId,
      short_url: '0',
      recipients: [
        {
          mobiles: toMsg91Mobile(phone),
          [otpVar]: code
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MSG91 OTP failed: ${text.slice(0, 200)}`);
  }
}

async function sendWebhookOtp(phone, code, ttlMinutes) {
  const url = process.env.OTP_WEBHOOK_URL;
  if (!url) throw new Error('OTP webhook is not configured');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.OTP_WEBHOOK_SECRET ? { authorization: `Bearer ${process.env.OTP_WEBHOOK_SECRET}` } : {})
    },
    body: JSON.stringify({
      phone: toE164(phone),
      code,
      ttl_minutes: ttlMinutes,
      message: `Your Hem Labdhi jewels OTP is ${code}. It expires in ${ttlMinutes} minutes.`
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OTP webhook failed: ${text.slice(0, 200)}`);
  }
}

async function deliverOtp(phone, code, ttlMinutes = 10) {
  const provider = getProvider();
  if (!provider) {
    if (shouldShowDemoOtp()) return { mode: 'demo' };
    throw new Error('OTP service is not configured');
  }

  if (provider === 'twilio') {
    await sendTwilioOtp(phone, code, ttlMinutes);
    return { mode: 'twilio' };
  }
  if (provider === 'msg91') {
    await sendMsg91Otp(phone, code);
    return { mode: 'msg91' };
  }
  if (provider === 'webhook') {
    await sendWebhookOtp(phone, code, ttlMinutes);
    return { mode: 'webhook' };
  }

  throw new Error(`Unsupported OTP provider: ${provider}`);
}

module.exports = {
  deliverOtp,
  shouldShowDemoOtp,
  toE164,
  toMsg91Mobile
};
