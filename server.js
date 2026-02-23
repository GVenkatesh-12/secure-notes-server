import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors'; // Added: To allow frontend connection
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000; // Updated: For deployment flexibility

// --- MIDDLEWARE ---
app.use(cors()); // Allows your website to talk to this API
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🚀 Connected to MongoDB!"))
    .catch(err => console.error("❌ Database error:", err));

// --- SCHEMAS & MODELS ---
const noteSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true }, // Added lowercase for consistency
    password: { type: String, required: true }
});

const blacklistSchema = new mongoose.Schema({
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '1h' }
});

const Note = mongoose.model('Note', noteSchema);
const User = mongoose.model('User', userSchema);
const Blacklist = mongoose.model('Blacklist', blacklistSchema);

// --- AUTHENTICATION MIDDLEWARE ---
const auth = async (req, res, next) => {
    try {
        let token = req.header('Authorization');
        if (!token) return res.status(401).json({ error: "Access Denied" });

        token = token.replace('Bearer ', '');

        // Check Blacklist
        const isBlacklisted = await Blacklist.findOne({ token });
        if (isBlacklisted) return res.status(401).json({ error: "Session expired. Please login again." });

        // Use environment variable for Secret Key
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'SUPER_SECRET_KEY');
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: "Invalid Token" });
    }
};

// --- ROUTES ---

// REGISTER
app.post('/register', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const newUser = new User({ email: req.body.email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: "User Registered!" });
    } catch (err) {
        res.status(400).json({ error: err.message }); // This will tell us the TRUTH
    }
});

// LOGIN
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(400).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid password" });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'SUPER_SECRET_KEY', { expiresIn: '1h' });
        res.json({ token, email: user.email });
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// LOGOUT
app.post('/logout', auth, async (req, res) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        await new Blacklist({ token }).save();
        res.json({ message: "Logged out successfully" });
    } catch (err) {
        res.status(500).json({ error: "Logout failed" });
    }
});

// NOTES: CREATE
app.post('/notes', auth, async (req, res) => {
    try {
        const newNote = new Note({ ...req.body, owner: req.user.userId });
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
app.patch('/notes/:id', auth, async (req, res) => {
    try {
        const updatedNote = await Note.findOneAndUpdate(
            { _id: req.params.id, owner: req.user.userId }, // Faster: checks ID AND Owner in one go
            req.body,
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

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});