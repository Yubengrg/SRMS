// routes/qrCodeRoutes.js
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Generate QR code for a table
router.post('/generate', async (req, res) => {
  try {
    const { data, fileName } = req.body;
    
    if (!data) {
      return res.status(400).json({ 
        success: false, 
        message: 'QR code data is required' 
      });
    }
    
    // Create directory if it doesn't exist
    const dir = './uploads/qrcodes';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Generate file name if not provided
    const qrFileName = fileName || `qrcode-${Date.now()}.png`;
    const filePath = path.join(dir, qrFileName);
    
    // Generate QR code
    await QRCode.toFile(filePath, data, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });
    
    const qrCodeUrl = `/uploads/qrcodes/${qrFileName}`;
    
    res.status(200).json({
      success: true,
      message: 'QR code generated successfully',
      qrCodeUrl
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating QR code'
    });
  }
});

module.exports = router;