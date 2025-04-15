const mysql = require('mysql2/promise');
require('dotenv').config();
async function setupDatabase() {
    try {
        // Tạo kết nối đến MySQL
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306,
        });
        // Xóa database cũ nếu tồn tại và tạo mới
        await connection.query(`DROP DATABASE IF EXISTS ${process.env.DB_NAME}`);
        await connection.query(`CREATE DATABASE ${process.env.DB_NAME}`);
        
        // Sử dụng database 
        await connection.query(`USE ${process.env.DB_NAME}`);

        // Tạo bảng users
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fullname VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Tạo bảng emails - Sửa lại phần foreign key
        await connection.query(`
            CREATE TABLE IF NOT EXISTS emails (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id INT NOT NULL,
                receiver_id INT NOT NULL,
                subject VARCHAR(255),
                body TEXT,
                attachment VARCHAR(255),
                original_filename VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Thêm dữ liệu mẫu - Users
        await connection.query(`
            INSERT INTO users (fullname, email, password) VALUES
            ('User A', 'a@a.com', '123'),
            ('User B', 'b@b.com', '123'),
            ('User C', 'c@c.com', '123')
        `);

        // Thêm dữ liệu mẫu - Emails
        await connection.query(`
            INSERT INTO emails (sender_id, receiver_id, subject, body, created_at) VALUES
            (2, 1, 'Hello A', 'This is a test email from B to A', '2024-03-15 10:00:00'),
            (3, 1, 'Greetings A', 'This is a test email from C to A', '2024-03-15 11:00:00'),
            (1, 2, 'Re: Hello', 'Reply from A to B', '2024-03-15 12:00:00'),
            (1, 3, 'Meeting Tomorrow', 'Let\\'s meet tomorrow at 2 PM', '2024-03-15 13:00:00'),
            (2, 3, 'Project Update', 'Here\\'s the latest project update', '2024-03-15 14:00:00'),
            (3, 2, 'Weekend Plans', 'Any plans for the weekend?', '2024-03-15 15:00:00'),
            (1, 2, 'Important Notice', 'Please read this important notice', '2024-03-15 16:00:00'),
            (2, 1, 'Re: Important Notice', 'I\\'ve read the notice', '2024-03-15 17:00:00')
        `);

        console.log('Database setup completed successfully');
        await connection.end();
    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    }
}

setupDatabase();
