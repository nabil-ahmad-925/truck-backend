var express = require('express');
var router = express.Router();
const { Pool } = require("pg");
const bcrypt = require("bcrypt"); // Import bcrypt for password hashing
const jwt = require('jsonwebtoken'); // Import jsonwebtoken for JWT
const nodemailer = require('nodemailer');
const crypto = require('crypto');
// Database connection details (replace with your actual settings)
const pool = new Pool({
  user: "postgres", // Replace with your username
  host: "localhost",
  database: "introviz", // Replace with your database name
  password: "1234", // Replace with your password
  port: 5432,
});

// Update the users table definition (if needed)
const usersTableQuery = `CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  company_name VARCHAR(255),
  phone VARCHAR(255)
);`;

// Generate random six-digit code
function generateRandomCode() {
  return Math.floor(100000 + Math.random() * 900000);
}


function generateRandomText() {
  const lettersAndNumbers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  let randomAlphanumeric = '';
  for (let i = 0; i < 8; i++) {
    randomAlphanumeric += lettersAndNumbers[Math.floor(Math.random() * lettersAndNumbers.length)];
  }

  return randomAlphanumeric;
}





 

// Configure SMTP settings (replace with your actual credentials)
const smtpTransport = nodemailer.createTransport({
service:"gmail",
  auth: {
    user: 'husnainabbas8059@gmail.com', // Replace with your email address
    pass: 'uzlwppyzkwkxjhvm' // Replace with your email password
  }
});

// const smtpTransport = nodemailer.createTransport({
//   host: 'smtp.introviz.com',
//   port: 25,
//   secure: false,
//   auth: {
//     user: 'info@introviz.com',
//     pass: 'leads$66$truckers',
//   },
// });


async function createUser(userData,res) {
  try {
    const client = await pool.connect();

    // Check if users table exists (optional, can be removed if already created)
    await client.query(usersTableQuery);

    // Hash the password before storing it
    const saltRounds = 10; // Adjust salt rounds as needed for security
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

    const query = `INSERT INTO users ( email, password, first_name, last_name, company_name,phone)
                   VALUES ($1, $2, $3, $4, $5,$6) RETURNING *`;
    const result = await client.query(query, [
      userData.email,
      hashedPassword,
      userData.firstName,
      userData.lastName,
      userData.companyName,
      userData.phone
    ]);

    if (result.rows.length > 0) {
      console.log("User created successfully!");
      res.status(200).json({ success: true, message: "User registered!" });
    } else {
      console.error("Error creating user!");
      res.status(500).json({ success: false, message: "Registration failed!" });
    }

    await client.release();
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ success: false, message: "Internal server error!" });
  }
}

/* POST register route */
router.post("/register", async (req, res, next) => {

  const client = await pool.connect();
  await client.query(usersTableQuery);

  const { email, password, firstName, lastName, companyName, verificationCode,phone } = req.body;
  console.log("Body ======++>",req.body)
  // Validate user data (optional, add checks format, email validity, etc.)
  if (!companyName || !email || !password || !firstName || !lastName || !verificationCode) {
    return res.status(400).json({ success: false, message: "Please fill in all required fields!" });
  }

  try {
    // Check if the verification code is valid for the provided email
    const checkCodeQuery = `SELECT * FROM verification_codes WHERE email = $1 AND code = $2`;
    const checkCodeResult = await pool.query(checkCodeQuery, [email, verificationCode]);

    if (checkCodeResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid verification code!" });
    }

      // Check if the email already exists in the users table
      const checkEmailQuery = `SELECT * FROM users WHERE email = $1`;
      const checkEmailResult = await pool.query(checkEmailQuery, [email]);
  
      if (checkEmailResult.rows.length > 0) {
        return res.status(409).json({ success: false, message: "Email already exists!" });
      }

    await createUser({ email, password, firstName, lastName, companyName,phone },res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error!" });
  }
});


// Login controller
router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;
  console
  // Validate user data (optional)
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Please enter email and password!" });
  }

  try {
    const client = await pool.connect();
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await client.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password!" });
    }

    const user = result.rows[0];

    // Compare hashed password with provided password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Invalid email or password!" });
    }

    // Generate JWT token on successful login
    const secret = 'GJJHGYGVJCHGJCGHTGCVJGK'; // Replace with a strong, unique secret key
    const payload = {
      user: user, // Include user ID in the payload
    };

    const token = jwt.sign(payload, secret, { expiresIn: '3600s' }); // Token expires in 1 hour

    res.json({ success: true, message: "Login successful!", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error!" });
  }
});

// Route and controller for generating and sending the code
router.post("/generate-code", async (req, res, next) => {

  console.log("source=========+>",req.body)
  const  email  = req.body.email._value;
  const  source = req.body.source;


  // const email = req.body.email;
  console.log("Email===>",req.body.email._value)
  // Validate email
  if (!email) {
    return res.status(400).json({ success: false, message: "Please provide an email address!" });
  }

  try {
    // Generate a random six-digit code
    const verificationCode = source  === 'forget'?generateNewPassword(email):generateRandomCode();

      // Check if verification_codes table exists (optional, can be removed if already created)
      const checkTableQuery = `CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code INT NOT NULL
      );`;
      await pool.query(checkTableQuery);
  
 
  
      // Insert the verification code into the database
      const insertCodeQuery = `INSERT INTO verification_codes (email, code) VALUES ($1, $2) RETURNING *`;
      await pool.query(insertCodeQuery, [email, verificationCode]);
  
    // Send the code to the provided email
    const mailOptions = {
      from: 'info@introviz.com',
      to: email,
      subject: 'Verification Code',
      text: `Your verification code is: ${verificationCode}`,
    };



    await smtpTransport.sendMail(mailOptions);

    // You can save the verification code in the database or use it for further verification

    res.json({ success: true, message: "Verification code sent successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error!" });
  }
});


// Route and controller for generating and sending the code
router.post("/reset-password", async (req, res, next) => {
  console.log("email", req.body);
  const email = req.body.email;

  // Validate email
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide an email address!" });
  }

  try {
    // Generate a random six-digit code
    const randomText = generateRandomText();

    const link = `http://localhost:5173/changepassword?code=${
      randomText
    }`;

    // Send the code to the provided email
    const mailOptions = {
      from: "info@introviz.com",
      to: email,
      subject: "Verification Code",
      text: `Go to this link ${link}`,
    };

    // Check if the verification_codes table exists (optional, can be removed if already created)
    const checkTableQuery = `
    CREATE TABLE IF NOT EXISTS verification_codes (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      code TEXT NOT NULL
    );
  `;
    await pool.query(checkTableQuery);

    // Insert the verification code into the database
    const insertCodeQuery = `INSERT INTO verification_codes (email, code) VALUES ($1, $2) RETURNING *`;
    const result = await pool.query(insertCodeQuery, [email, randomText]);

    await smtpTransport.sendMail(mailOptions);

    // You can save the verification code in the database or use it for further verification
    console.log("Verification code inserted:", result.rows[0]);

    res.json({
      success: true,
      message: "Verification code sent successfully!",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Internal server error!" });
  }
});




// Route and controller for changing the password
router.post("/change-password", async (req, res, next) => {
  const { code, newPassword } = req.body;

  try {
    // Check if the code exists in the verification_codes table
    const checkCodeQuery = `
      SELECT * FROM verification_codes WHERE code = $1;
    `;
    const codeResult = await pool.query(checkCodeQuery, [code]);

    // If the code is not found, return an error
    if (codeResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid verification code!" });
    }

    // Get the email associated with the code
    const email = codeResult.rows[0].email;

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the hashed password in the users table
    const updatePasswordQuery = `
      UPDATE users SET password = $1 WHERE email = $2;
    `;
    await pool.query(updatePasswordQuery, [hashedPassword, email]);

    // Remove the used verification code from the verification_codes table
    const deleteCodeQuery = `
      DELETE FROM verification_codes WHERE code = $1;
    `;
    await pool.query(deleteCodeQuery, [code]);

    res.json({ success: true, message: "Password changed successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error!" });
  }
});








module.exports = router;
