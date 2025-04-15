// import các thư viện cần thiết
const express = require('express');
const { engine } =require('express-handlebars');
const mysql = require('mysql2/promise');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const multer =require('multer');
const path = require('path');
const fs =require('fs');
const { error } = require('console');
// const khong thay doi duoc gia tri

// Tạo ứng dụng express
const app =express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('publics'));

// tạo thư mục uploads nếu chưa tồn tại
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
//code doan nay cu khong hieu....
// cấu hình multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Sử dụng đường dẫn tuyệt đối
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Tạo tên file unique
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = path.extname(file.originalname);
        const fileName = `${uniqueSuffix}${fileExt}`;
        console.log('Saving file as:', fileName); // Thêm log
        cb(null, fileName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

// Thêm middleware để phục vụ files từ thư mục uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Thiết lập Handlebars làm view engine
app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: 'views/layouts',
    helpers: {
        formatDate: function(date) {
            return new Date(date).toLocaleString();
        }
    }
}));
app.set('view engine', 'hbs');
// Kết nối database
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});
// Route chính
app.get('/', (req, res) => {
    if (req.cookies.loggedIn) {
        res.redirect('/inbox');
    } else {
        res.redirect('/login');
    }
});
// route đăng nhập
app.get('/login', (req, res) => {
    if (req.cookies.loggedIn) {
        res.redirect('/inbox');
    } else {
        res.render('signin');
    }
});
app.post('/login', async(req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND password = ?',
            [email, password]
        );
        if (users.length > 0) {
            res.cookie('loggedIn', true);
            res.cookie('userId', users[0].id);
            res.cookie('userFullname', users[0].fullname);
            res.redirect('/inbox');
        } else {
            res.render('signin', {
                error: 'Invalid email or password'
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.render('signin', {
            error: 'An error occurred during login'
        });
    }
});
// signup router
app.get('/signup',(req,res)=>{
    if (req.cookie.loggedIn){
        req.redirect('/inbox');
    }else{req.render('signup');
        
    }

});

//dang code den day
app.post('/signup', async (req, res) => {
    const { fullname, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.render('signup', {
            error: 'Passwords do not match',
            fullname,
            email
        });
    }
    try {
        const [existingUsers] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.render('signup', {
                error: 'Email already exists',
                fullname
            });
        }

        await pool.query(
            'INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)',
            [fullname, email, password]
        );
        res.redirect('/login');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('signup', {
            error: 'An error occurred during registration',
            fullname,
            email
        });
    }
});

// inbox route
app.get('/inbox', async (req, res) => {
    // Check if req.cookies is defined
    if (!req.cookies.loggedIn) {
        return res.redirect('/login');
    }

    try {
        const [emails] = await pool.query(
            `SELECT e.*, u.fullname as sender_name 
             FROM emails e 
             JOIN users u ON e.sender_id = u.id 
             WHERE e.receiver_id = ? 
             ORDER BY e.created_at DESC`,
            [req.cookies.userId]
        );

        res.render('inbox', {
            emails,
            loggedIn: true,
            userFullname: req.cookies.userFullname
        });
    } catch (error) {
        console.error('Error loading inbox:', error);
        res.render('inbox', {
            emails: [],
            error: 'Error loading emails',
            loggedIn: true,
            userFullname: req.cookies.userFullname
        });
    }
});
app.get('/emails/:id/download', async (req, res) => {
    if (!req.cookies.loggedIn) {
        return res.redirect('/login');
    }

    try {
        const [emails] = await pool.query(
            `SELECT e.*, 
                    u_sender.fullname as sender_name,
                    u_receiver.fullname as receiver_name
             FROM emails e 
             JOIN users u_sender ON e.sender_id = u_sender.id
             JOIN users u_receiver ON e.receiver_id = u_receiver.id
             WHERE e.id = ? AND (e.sender_id = ? OR e.receiver_id = ?)`,
            [req.params.id, req.cookies.userId, req.cookies.userId]
        );

        if (emails.length === 0) {
            return res.redirect('/inbox');
        }

        const email = emails[0];
        
        // Tạo nội dung email để download
        let emailContent = `From: ${email.sender_name}\n`;
        emailContent += `Date: ${new Date(email.created_at).toLocaleString()}\n`;
        emailContent += `Subject: ${email.subject}\n\n`;
        emailContent += `${email.body}\n\n`;
        
        if (email.attachment) {
            emailContent += `Attachment: ${email.attachment}\n`;
        }

        // Tạo tên file
        const fileName = `email_${email.id}_${new Date().getTime()}.txt`;
        
        // Set headers để browser download file
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        // Gửi nội dung email
        res.send(emailContent);

    } catch (error) {
        console.error('Error downloading email:', error);
        res.redirect('/emails/' + req.params.id);
    }
});
// outbox route
app.get('/outbox', async (req, res) => {
    if (!req.cookies.loggedIn) {
        return res.redirect('/login');
    }

    try {
        // Lấy trang hiện tại từ query params, mặc định là 1
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 10; // Số email trên mỗi trang
        const offset = (page - 1) * itemsPerPage;

        // Lấy tổng số email đã gửi
        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM emails WHERE sender_id = ?',
            [req.cookies.userId]
        );
        const totalEmails = countResult[0].total;
        const totalPages = Math.ceil(totalEmails / itemsPerPage);

        // Lấy danh sách email đã gửi với phân trang
        const [emails] = await pool.query(
            `SELECT e.*, u.fullname as recipient_name 
             FROM emails e 
             JOIN users u ON e.receiver_id = u.id 
             WHERE e.sender_id = ? 
             ORDER BY e.created_at DESC
             LIMIT ? OFFSET ?`,
            [req.cookies.userId, itemsPerPage, offset]
        );

        // Thêm helper function cho template
        const helpers = {
            range: function(start, end) {
                const result = [];
                for (let i = start; i <= end; i++) {
                    result.push(i);
                }
                return result;
            },
            eq: function(v1, v2) {
                return v1 === v2;
            }
        };

        res.render('outbox', {
            emails,
            currentPage: page,
            totalPages,
            loggedIn: true,
            userFullname: req.cookies.userFullname,
            helpers
        });
    } catch (error) {
        console.error('Error loading outbox:', error);
        res.render('outbox', {
            emails: [],
            error: 'Error loading sent emails',
            loggedIn: true,
            userFullname: req.cookies.userFullname
        });
    }
});
// compose routes
app.get('/compose', async (req, res) => {
    if (!req.cookies.loggedIn) {
        return res.redirect('/login');
    }

    try {
        const [users] = await pool.query(
            'SELECT id, fullname, email FROM users WHERE id != ?',
            [req.cookies.userId]
        );

        res.render('compose', {
            users,
            loggedIn: true,
            userFullname: req.cookies.userFullname
        });
    } catch (error) {
        console.error('Error loading compose page:', error);
        res.render('compose', {
            users: [],
            error: 'Error loading recipients',
            loggedIn: true,
            userFullname: req.cookies.userFullname
        });
    }
});

app.post('/compose', upload.single('attachment'), async (req, res) => {
    if (!req.cookies.loggedIn) {
        return res.redirect('/login');
    }

    try {
        const { recipient, subject, body } = req.body;
        const senderId = parseInt(req.cookies.userId);
        // xử lý file đính kèm
        let attachmentFileName = null;
        let originalFileName = null;
        
        if (req.file) {
            attachmentFileName = req.file.filename;
            originalFileName = req.file.originalname;
            console.log('File uploaded successfully:', {
                savedAs: attachmentFileName,
                originalName: originalFileName,
                path: req.file.path
            });
        }

        // kiểm tra người gửi và người nhận cùng lúc
        const [users] = await pool.query(
            'SELECT id FROM users WHERE id IN (?, ?)',
            [senderId, recipient]
        );

        if (users.length !== 2) {
            throw new Error('Invalid sender or recipient');
        }

        // thêm email vào database
        const [result] = await pool.query(
            `INSERT INTO emails (
                sender_id, 
                receiver_id, 
                subject, 
                body, 
                attachment,
                original_filename
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                senderId,
                parseInt(recipient),
                subject || '(no subject)',
                body || '',
                attachmentFileName,
                originalFileName
            ]
        );

        if (result.affectedRows > 0) {
            const [allUsers] = await pool.query(
                'SELECT id, fullname, email FROM users WHERE id != ?',
                [senderId]
            );
            
            return res.render('compose', {
                users: allUsers,
                loggedIn: true,
                userFullname: req.cookies.userFullname,
                success: 'Email sent successfully!'
            });
        } else {
            throw new Error('Failed to send email');
        }

    } catch (error) {
        console.error('Error in /compose:', error);
        
        // nếu có lỗi và đã upload file, xóa file
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }

        const [users] = await pool.query(
            'SELECT id, fullname, email FROM users WHERE id != ?',
            [req.cookies.userId]
        );

        res.render('compose', {
            users,
            loggedIn: true,
            userFullname: req.cookies.userFullname,
            error: error.message || 'Failed to send email',
            formData: {
                subject: req.body.subject || '',
                body: req.body.body || '',
                recipient: req.body.recipient || ''
            }
        });
    }
});
// helper function to get users
async function getUsers(currentUserId) {
    const [users] = await pool.query(
        'SELECT id, fullname, email FROM users WHERE id != ?',
        [currentUserId]
    );
    return users;
}

// email detail route
app.get('/emails/:id', async (req, res) => {
    if (!req.cookies.loggedIn) {
        return res.redirect('/login');
    }

    try {
        // lấy thông tin email, người gửi và attachment
        const [emails] = await pool.query(
            `SELECT 
                e.*,
                u.fullname as sender_name,
                u.email as sender_email
             FROM emails e 
             JOIN users u ON e.sender_id = u.id 
             WHERE e.id = ? AND (e.sender_id = ? OR e.receiver_id = ?)`,
            [req.params.id, req.cookies.userId, req.cookies.userId]
        );

        if (emails.length === 0) {
            console.log('Email not found or access denied');
            return res.redirect('/inbox');
        }
        const email = emails[0];
        // kiểm tra quyền truy cập
        if (email.sender_id !== parseInt(req.cookies.userId) && 
            email.receiver_id !== parseInt(req.cookies.userId)) {
            console.log('Unauthorized access to email');
            return res.redirect('/inbox');
        }
        // xử lý attachment
        if (email.attachment) {
            email.attachmentUrl = `/uploads/${email.attachment}`;
            // sử dụng tên file gốc nếu có, nếu không thì dùng tên file đã lưu
            email.originalFileName = email.original_filename || email.attachment;
            console.log('Attachment info:', {
                url: email.attachmentUrl,
                filename: email.originalFileName++
            });
        }

        res.render('email', {
            email,
            loggedIn: true,
            userFullname: req.cookies.userFullname
        });

    } catch (error) {
        console.error('Error loading email:', error);
        res.redirect('/inbox');
    }
});

// logout route
app.post('/logout', (req, res) => {
    res.clearCookie('loggedIn');
    res.clearCookie('userId');
    res.clearCookie('userFullname');
    res.redirect('/login');
});
//khởi động server
const PORT = process.env.PORT || 8000;
        app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});                    
