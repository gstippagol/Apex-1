const User = require('../models/User');
const xlsx = require('xlsx');

exports.bulkRegister = async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const file = req.files.file;
        const workbook = xlsx.read(file.data, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const row of data) {
            try {
                const name = row.name || row.Name;
                const usn = row.usn || row.USN || row.registerNumber;
                
                // Custom Password Logic: Name (first 5 letters) + Mobile last 4 digits + @apex
                const rawMobile = row.mobileNumber || row.Mobile || row.Phone || '';
                let formattedMobile = rawMobile.toString().trim();
                if (formattedMobile && !formattedMobile.startsWith('+91')) {
                    formattedMobile = `+91${formattedMobile}`;
                }

                let defaultPassword = 'Apex@123';
                if (name && formattedMobile) {
                    const firstName = name.trim().split(' ')[0];
                    const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
                    const slicedName = formattedName.slice(0, 5);
                    const last4Mobile = formattedMobile.length >= 4 ? formattedMobile.slice(-4) : '';
                    defaultPassword = `${slicedName}${last4Mobile}@apex`;
                }

                const userData = {
                    name: name,
                    email: row.email || row.Email,
                    password: row.password || row.Password || defaultPassword,
                    department: row.department || row.Department,
                    usn: usn,
                    mobileNumber: formattedMobile,
                    role: 'student'
                };

                // Basic validation
                if (!userData.name || !userData.email || !userData.usn || !userData.mobileNumber || !userData.department) {
                    throw new Error(`Missing required fields for ${userData.email || 'unknown user'}`);
                }

                await User.create(userData);
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push({
                    user: row.email || row.usn || 'Unknown',
                    error: err.message
                });
            }
        }

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'user', action: 'bulk-register' });

        res.status(200).json({
            success: true,
            message: `Processed ${data.length} records. ${results.success} successful, ${results.failed} failed.`,
            data: results
        });

    } catch (err) {
        console.error('Bulk Upload Error:', err);
        res.status(500).json({ success: false, message: 'Internal server error during bulk processing' });
    }
};
