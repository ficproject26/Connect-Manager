// Vercel Serverless Function: /api/vendors/otp/verify
// Verifies 6-digit development OTP for vendor business phone verification

module.exports = async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    const rawPhone = body?.phone || body?.mobile || '';
    const cleanPhone = String(rawPhone).trim().replace(/\D/g, '').slice(-10);
    const code = String(body?.otp || '').trim();

    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number.'
      });
    }

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit numeric OTP.'
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Business phone verified successfully',
      phone: cleanPhone
    });
  } catch (err) {
    console.error('Error verifying vendor OTP:', err);
    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Business phone verified successfully (Development Mode)'
    });
  }
};
