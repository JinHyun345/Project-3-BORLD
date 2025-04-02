import express from "express";
import mysql from "mysql2";
import jwt from "jsonwebtoken";
import cors from 'cors';
import "dotenv/config"; // .env 파일 불러오기
import FormData from "form-data";
import Mailgun from "mailgun.js";
import bcrypt from "bcrypt";

const port = 5000;

const app = express();
app.use(express.json());
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "#%gimco682GILgodarling",
    database: "p3"
});
db.connect((err) => {
    if (err) {
        console.error("❌ MySQL 연결 실패:", err);
    } else {
        console.log("✅ MySQL 연결 성공!");
    }
});

async function sendVerificationEmail(email, verificationCode) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.API_KEY, // .env에서 API 키 불러오기
  });

  try {
    const data = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: `Mailgun Sandbox <${process.env.SENDER_EMAIL}>`,
      to: email, // 수신자 이메일 (승인된 이메일)
      subject: "Project_3_BORLD : Verification Code",
      text: `Your verification code is ${verificationCode}`,
    });
    console.log("📨 이메일 전송 성공:", data);
    return true;
  } catch (error) {
    console.error("❌ 이메일 전송 실패:", error);
    return false;
  }
}

const verificationCodes = {};

app.post("/send-verification-code", async (req, res) => {
    const { email } = req.body;
    const verificationCode = Math.floor(100000 + Math.random() * 900000);

    const sql = `
        INSERT INTO verification_codes (email, code) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE code = ?, created_at = CURRENT_TIMESTAMP
    `;

    db.query(sql, [email, verificationCode, verificationCode], (err, result) => {
        if (err) {
            console.error("❌ 인증번호 저장 실패:", err);
            return res.status(500).json({ error: "Database error" });
        }
        console.log(`📨 인증번호 db저장: ${email} - ${verificationCode}`);
    });
    const success = await sendVerificationEmail(email, verificationCode);
    if (success) {
        res.json({ message: "서버:인증번호가 발송되었습니다." });
    } else {
        res.status(500).json({ error: "서버: 인증번호 발송에 실패했습니다." });
    }
});

app.post("/verify-code", (req, res) => {
    const { email, code } = req.body;

    const sql = `SELECT code, created_at FROM verification_codes WHERE email = ?`;
    db.query(sql, [email], (err, results) => {
        if (err) {
            console.error("❌ 인증번호 검증 실패:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            return res.status(400).json({ error: "Email not found" });
        }

        const { code: storedCode, created_at } = results[0];

        // 10분 이내에 입력했는지 확인
        const timeElapsed = (new Date() - new Date(created_at)) / 60000;
        if (storedCode === code && timeElapsed <= 10) {
            return res.json({ message: "서버:인증이성공했씁니다.!" });
        } else {
            return res.status(400).json({ error: "서버:인증실패" });
        }
    });
});



app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: "서버:비밀번호는 영문, 숫자, 특수문자를 포함하여 10자 이상이어야 합니다." });
    }
    if (!username || !email || !password) {
        return res.status(400).json({ error: "서버:사용자 정보 다 입력해야 함" });
    }
    try {
        db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            if (results.length > 0) {
                return res.status(400).json({ error: "이미 등록된 유저입니다." });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            db.query(
                "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                [username, email, hashedPassword],
                (err, result) => {
                    if (err) {
                        console.error("Insert error:", err);
                        return res.status(500).json({ error: "Error inserting user" });
                    }
                    res.status(201).json({ message: "서버: 회원가입이 완료되었습니다." });
                }
            );
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Server error" });
    }
});


app.post("/signin", (req, res) => {
    const { email, password } = req.body;

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (err) return res.status(500).json({ error: err });
        if (results.length === 0) return res.status(401).json({ error: "User not found" });
        const isMatch = await bcrypt.compare(password, results[0].password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: results[0].id }, "your_secret_key", { expiresIn: "1h" });
        console.log("Generated Token:", token);
        res.json({ token, username: results[0].username });
    });
});

// 회원 탈퇴 기능 추가
app.delete("/delete", (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(400).json({ error: "Token is required" });
    }
    const token = authHeader.split(" ")[1]; // 👈 'Bearer ' 제거하고 토큰만 추출
    // 토큰을 확인하여 사용자 ID 추출
    jwt.verify(token, "your_secret_key", (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        const userId = decoded.id;

        // 사용자를 삭제하는 쿼리 실행
        db.query("DELETE FROM users WHERE id = ?", [userId], (err, results) => {
            if (err) {
                console.error("Error deleting user:", err);
                return res.status(500).json({ error: "Error deleting user" });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({ error: "User not found" });
            }

            res.status(200).json({ message: "User deleted successfully" });
        });
    });
});


app.listen(port, () => console.log('서버 실행 중...'));