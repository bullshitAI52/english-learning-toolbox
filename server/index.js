require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { router: authRouter } = require("./auth");
const dataRouter = require("./routes");
const wordlistRouter = require("./wordlists");
const adminRouter = require("./admin");

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
    "http://107.172.32.153",
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1",
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
}));

app.use(express.json({ limit: "10mb" }));

const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts, please try again later." },
});

app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api", dataRouter);
app.use("/api", wordlistRouter);
app.use("/api", adminRouter);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
