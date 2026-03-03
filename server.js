import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors'; // Added: To allow frontend connection
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000; // Updated: For deployment flexibility
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGO_URI) {
    console.error("❌ Missing required environment variable: MONGO_URI");
    process.exit(1);
}

if (!JWT_SECRET) {
    console.error("❌ Missing required environment variable: JWT_SECRET");
    process.exit(1);
}

// --- MIDDLEWARE ---
app.use(cors()); // Allows your website to talk to this API
app.use(express.json({limit: '50mb'}));
app.set('trust proxy', 1);

// --- SCHEMAS & MODELS ---
const noteSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
noteSchema.index({ owner: 1, createdAt: -1 });

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true }, // Added lowercase for consistency
    password: { type: String, required: true }
});

const blacklistSchema = new mongoose.Schema({
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }
});
blacklistSchema.index({ token: 1 });

const Note = mongoose.model('Note', noteSchema);
const User = mongoose.model('User', userSchema);
const Blacklist = mongoose.model('Blacklist', blacklistSchema);

// --- AUTHENTICATION MIDDLEWARE ---
const auth = async (req, res, next) => {
    try {
        let token = req.header('Authorization');
        if (!token) return res.status(401).json({ error: "Access Denied" });

        token = token.startsWith('Bearer ') ? token.slice(7) : token;
        if (!token) return res.status(401).json({ error: "Access Denied" });

        // Check Blacklist
        const isBlacklisted = await Blacklist.findOne({ token });
        if (isBlacklisted) return res.status(401).json({ error: "Session expired. Please login again." });

        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid Token" });
    }
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const createRateLimiter = ({ windowMs, max, message }) => {
    const store = new Map();

    return (req, res, next) => {
        const now = Date.now();
        const key = `${req.ip}:${req.path}`;
        const current = store.get(key);

        if (!current || now > current.resetAt) {
            store.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        current.count += 1;
        if (current.count > max) {
            return res.status(429).json({ error: message });
        }

        next();
    };
};

const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many login attempts. Please try again later."
});

const registerLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many registration attempts. Please try again later."
});

const passwordChangeLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many password change attempts. Please try again later."
});

const validateAuthPayload = (req, res, next) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: "Invalid input" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: "Invalid input" });
    }

    if (password.length < 6 || password.length > 128) {
        return res.status(400).json({ error: "Invalid input" });
    }

    req.authPayload = { email: normalizedEmail, password };
    next();
};

const validateNoteCreatePayload = (req, res, next) => {
    const { title, content } = req.body || {};
    if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: "Title is required" });
    }

    if (content !== undefined && typeof content !== 'string') {
        return res.status(400).json({ error: "Invalid content" });
    }

    req.noteCreateData = {
        title: title.trim(),
        ...(content !== undefined ? { content } : {})
    };
    next();
};

const validateNoteUpdatePayload = (req, res, next) => {
    const { title, content } = req.body || {};
    const updates = {};

    if (title !== undefined) {
        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ error: "Title is required" });
        }
        updates.title = title.trim();
    }

    if (content !== undefined) {
        if (typeof content !== 'string') {
            return res.status(400).json({ error: "Invalid content" });
        }
        updates.content = content;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
    }

    req.noteUpdates = updates;
    next();
};

const validateChangePasswordPayload = (req, res, next) => {
    const { oldPassword, newPassword } = req.body || {};
    if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
        return res.status(400).json({ error: "Invalid input" });
    }

    if (newPassword.length < 6 || newPassword.length > 128) {
        return res.status(400).json({ error: "Invalid input" });
    }

    req.passwordPayload = { oldPassword, newPassword };
    next();
};

// --- ROUTES ---

// HEALTH CHECK
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// REGISTER
app.post('/register', registerLimiter, validateAuthPayload, async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.authPayload.password, 10);
        const newUser = new User({ email: req.authPayload.email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: "User Registered!" });
    } catch (err) {
    console.error("DEBUG ERROR:", err.message); // You see this in Render logs
    res.status(400).json({ error: "Registration failed. Check your data or try another email." }); // User sees this
}
});

// LOGIN
app.post('/login', loginLimiter, validateAuthPayload, async (req, res) => {
    try {
        const { email, password } = req.authPayload;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid password" });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, email: user.email });
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// LOGOUT
app.post('/logout', auth, async (req, res) => {
    try {
        const authHeader = req.header('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        if (!token) return res.status(401).json({ error: "Access Denied" });
        await new Blacklist({ token }).save();
        res.json({ message: "Logged out successfully" });
    } catch (err) {
        res.status(500).json({ error: "Logout failed" });
    }
});

// NOTES: CREATE
app.post('/notes', auth, validateNoteCreatePayload, async (req, res) => {
    try {
        const newNote = new Note({ ...req.noteCreateData, owner: req.user.userId });
        await newNote.save();
        res.status(201).json(newNote);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// NOTES: READ ALL
app.get('/notes', auth, async (req, res) => {
    try {
        const myNotes = await Note.find({ owner: req.user.userId }).sort({ createdAt: -1 });
        res.json(myNotes);
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// NOTES: UPDATE
app.patch('/notes/:id', auth, validateNoteUpdatePayload, async (req, res) => {
    try {
        const updatedNote = await Note.findOneAndUpdate(
            { _id: req.params.id, owner: req.user.userId }, // Faster: checks ID AND Owner in one go
            req.noteUpdates,
            { new: true, runValidators: true }
        );
        if (!updatedNote) return res.status(404).json({ error: "Note not found or unauthorized" });
        res.json(updatedNote);
    } catch (err) {
        res.status(400).json({ error: "Update failed" });
    }
});

// NOTES: DELETE
app.delete('/notes/:id', auth, async (req, res) => {
    try {
        const deletedNote = await Note.findOneAndDelete({ _id: req.params.id, owner: req.user.userId });
        if (!deletedNote) return res.status(404).json({ error: "Note not found or unauthorized" });
        res.json({ message: "Note deleted!" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// ROUTE: Change Password (while logged in)
app.post('/change-password', auth, passwordChangeLimiter, validateChangePasswordPayload, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.passwordPayload;

        // 1. Find the user by the ID stored in the JWT token
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // 2. Verify the old password is correct
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: "Current password is incorrect" });

        // 3. Hash and save the new password
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: "Password updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Could not update password" });
    }
});

const startServer = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("🚀 Connected to MongoDB!");
        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error("❌ Database error:", err);
        process.exit(1);
    }
};

startServer();
