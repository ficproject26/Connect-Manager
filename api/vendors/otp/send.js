// Vercel Serverless Function: /api/vendors/otp/send
// Generates a 6-digit development OTP for vendor business phone verification

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

    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9.'
      });
    }

    // Generate random 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    return res.status(200).json({
      success: true,
      message: `OTP generated successfully for +91 ${cleanPhone}. Valid for 5 minutes.`,
      otp,
      phone: cleanPhone,
      cooldownSeconds: 30,
      expiresInSeconds: 300
    });
  } catch (err) {
    console.error('Error generating vendor OTP:', err);
    const fallbackOtp = String(Math.floor(100000 + Math.random() * 900000));
    return res.status(200).json({
      success: true,
      message: 'Development OTP generated',
      otp: fallbackOtp,
      cooldownSeconds: 30
    });
  }
};
