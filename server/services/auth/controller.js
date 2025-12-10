const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const queries = require("./queries");
const { authConfig } = require("./authConfig");

const hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    // Generate a 64-byte salt (fits in VARBINARY(128))
    const salt = crypto.randomBytes(64);

    // Hash using PBKDF2: Password, Salt, Iterations, KeyLength, Digest
    crypto.pbkdf2(password, salt, 100000, 64, "sha512", (err, derivedKey) => {
      if (err) reject(err);
      resolve({ salt, hash: derivedKey });
    });
  });
};

const verifyPassword = (password, storedHash, storedSalt) => {
  return new Promise((resolve, reject) => {
    // Use the exact same parameters as hashPassword
    crypto.pbkdf2(
      password,
      storedSalt,
      100000,
      64,
      "sha512",
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(crypto.timingSafeEqual(storedHash, derivedKey));
      }
    );
  });
};

// --- CONTROLLERS ---

module.exports = {
  createPassword: async (req, res) => {
    const { inviteToken, newPassword } = req.body;

    try {
      if (!inviteToken || !newPassword) {
        return res
          .status(400)
          .json({ message: "Token and password are required." });
      }

      const user = await queries.getUserByInviteToken(inviteToken);

      if (!user) {
        return res
          .status(404)
          .json({ message: "Invalid or expired invite token." });
      }

      if (new Date() > new Date(user.invite_token_expires_at)) {
        return res.status(400).json({ message: "Invite token has expired." });
      }

      const { salt, hash } = await hashPassword(newPassword);

      await queries.updateUserCredentials(user.user_id, {
        password_hash: hash,
        password_salt: salt,
        invite_token: null,
        invite_token_expires_at: null,
      });

      return res
        .status(200)
        .json({ message: "Password created successfully. You may now login." });
    } catch (error) {
      console.error("Create Password Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  login: async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await queries.getUserByEmail(email);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      if (user.user_type === "Internal") {
        return res.status(403).json({
          message:
            "Please use the 'Login with Microsoft' button for this account.",
        });
      }

      if (!user.password_hash || !user.password_salt) {
        return res.status(401).json({
          message: "Account not fully set up. Please check your invite.",
        });
      }

      const isValid = await verifyPassword(
        password,
        user.password_hash,
        user.password_salt
      );

      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      const token = jwt.sign(
        {
          userId: user.user_id,
          email: user.email,
          role: user.user_type,
          displayName: user.display_name,
        },
        process.env.JWT_SECRET || "your_fallback_secret",
        { expiresIn: "8h" }
      );

      return res.status(200).json({
        message: "Login successful",
        token: token,
        user: {
          id: user.user_id,
          email: user.email,
          displayName: user.display_name,
        },
      });
    } catch (error) {
      console.error("Login Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  logout: (req, res) => {
    return res.status(200).json({ message: "Logged out successfully." });
  },

  createUser: async (req, res) => {
    const { email, displayName } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    try {
      const existingUser = await queries.getUserByEmail(email);

      if (existingUser) {
        return res
          .status(409)
          .json({ message: "User with this email already exists." });
      }

      const inviteToken = crypto.randomBytes(32).toString("hex");
      const inviteTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await queries.createExternalUser({
        email,
        displayName,
        inviteToken,
        inviteTokenExpiresAt,
      });

      const inviteLink = `${process.env.FRONTEND_URL}/create-password?token=${inviteToken}`;
      return res
        .status(201)
        .json({ message: "User created and invite email sent." });
    } catch (error) {
      console.error("Create User Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
};
