const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "100kb" }));

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "recallrocket.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const starterData = {
  cards: [
    {
      id: 1,
      subject: "JavaScript",
      question: "What is JavaScript?",
      answer: "A programming language used to make websites interactive.",
      interval: 1,
      ease: 2.5,
      due: new Date().toISOString(),
      reviews: 0,
      correct: 0
    },
    {
      id: 2,
      subject: "HTML",
      question: "What does HTML stand for?",
      answer: "HyperText Markup Language.",
      interval: 1,
      ease: 2.5,
      due: new Date().toISOString(),
      reviews: 0,
      correct: 0
    },
    {
      id: 3,
      subject: "Computer Science",
      question: "What is an algorithm?",
      answer: "A sequence of steps used to solve a problem.",
      interval: 1,
      ease: 2.5,
      due: new Date().toISOString(),
      reviews: 0,
      correct: 0
    },
    {
      id: 4,
      subject: "CSS",
      question: "What is CSS used for?",
      answer: "CSS controls the appearance and layout of web pages.",
      interval: 1,
      ease: 2.5,
      due: new Date().toISOString(),
      reviews: 0,
      correct: 0
    }
  ],
  history: [],
  xp: 0,
  streak: 0,
  lastStudyDate: null
};

function saveData() {
  const temporaryFile = DATA_FILE + ".tmp";
  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(db, null, 2),
    "utf8"
  );
  fs.renameSync(temporaryFile, DATA_FILE);
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const saved = JSON.parse(
        fs.readFileSync(DATA_FILE, "utf8")
      );

      return {
        ...starterData,
        ...saved,
        cards: Array.isArray(saved.cards) ? saved.cards : [],
        history: Array.isArray(saved.history) ? saved.history : []
      };
    }
  } catch (error) {
    console.error("Data loading error:", error.message);
  }

  return JSON.parse(JSON.stringify(starterData));
}

let db = loadData();

if (!fs.existsSync(DATA_FILE)) saveData();

function nextId() {
  return Math.max(0, ...db.cards.map(card => card.id)) + 1;
}

function validText(value, maxLength) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength;
}

function updateStreak() {
  const today = new Date().toISOString().slice(0, 10);

  if (db.lastStudyDate === today) return;

  const yesterday = new Date(Date.now() - 86400000)
    .toISOString().slice(0, 10);

  db.streak = db.lastStudyDate === yesterday
    ? db.streak + 1
    : 1;

  db.lastStudyDate = today;
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "RecallRocket",
    version: "3.0.0"
  });
});

app.get("/api/dashboard", (req, res) => {
  const correct = db.history.filter(item => item.correct).length;
  const reviews = db.history.length;

  const dueCards = db.cards.filter(
    card => new Date(card.due) <= new Date()
  ).length;

  res.json({
    totalCards: db.cards.length,
    dueCards,
    reviews,
    accuracy: reviews
      ? Math.round(correct / reviews * 100)
      : 0,
    xp: db.xp,
    streak: db.streak,
    subjects: [...new Set(db.cards.map(c => c.subject))],
    history: db.history.slice(-7)
  });
});

app.get("/api/cards", (req, res) => {
  const search = String(req.query.search || "").toLowerCase();
  const subject = String(req.query.subject || "");

  const results = db.cards.filter(card => {
    const matchesSearch =
      card.question.toLowerCase().includes(search) ||
      card.answer.toLowerCase().includes(search) ||
      card.subject.toLowerCase().includes(search);

    const matchesSubject =
      !subject || card.subject === subject;

    return matchesSearch && matchesSubject;
  });

  res.json(results);
});

app.post("/api/cards", (req, res) => {
  const { subject, question, answer } = req.body;

  if (
    !validText(subject, 60) ||
    !validText(question, 500) ||
    !validText(answer, 2000)
  ) {
    return res.status(400).json({
      error: "Please enter a valid subject, question and answer."
    });
  }

  const card = {
    id: nextId(),
    subject: subject.trim(),
    question: question.trim(),
    answer: answer.trim(),
    interval: 1,
    ease: 2.5,
    due: new Date().toISOString(),
    reviews: 0,
    correct: 0
  };

  db.cards.push(card);
  saveData();

  res.status(201).json(card);
});

app.put("/api/cards/:id", (req, res) => {
  const card = db.cards.find(
    item => item.id === Number(req.params.id)
  );

  if (!card) {
    return res.status(404).json({ error: "Card not found." });
  }

  const { subject, question, answer } = req.body;

  if (
    !validText(subject, 60) ||
    !validText(question, 500) ||
    !validText(answer, 2000)
  ) {
    return res.status(400).json({ error: "Invalid card details." });
  }

  card.subject = subject.trim();
  card.question = question.trim();
  card.answer = answer.trim();

  saveData();
  res.json(card);
});

app.delete("/api/cards/:id", (req, res) => {
  const oldLength = db.cards.length;

  db.cards = db.cards.filter(
    card => card.id !== Number(req.params.id)
  );

  if (oldLength === db.cards.length) {
    return res.status(404).json({ error: "Card not found." });
  }

  saveData();
  res.json({ message: "Card deleted." });
});

app.post("/api/review/:id", (req, res) => {
  const card = db.cards.find(
    item => item.id === Number(req.params.id)
  );

  if (!card) {
    return res.status(404).json({ error: "Card not found." });
  }

  if (typeof req.body.correct !== "boolean") {
    return res.status(400).json({ error: "Invalid review result." });
  }

  const correct = req.body.correct;

  card.reviews++;

  if (correct) {
    card.correct++;
    card.interval = card.reviews === 1
      ? 1
      : Math.max(1, Math.round(card.interval * card.ease));

    card.ease = Math.min(3.0, card.ease + 0.1);
    db.xp += 15;
  } else {
    card.interval = 1;
    card.ease = Math.max(1.3, card.ease - 0.2);
    db.xp += 5;
  }

  card.due = new Date(
    Date.now() + card.interval * 86400000
  ).toISOString();

  updateStreak();

  db.history.push({
    cardId: card.id,
    subject: card.subject,
    correct,
    date: new Date().toISOString()
  });

  if (db.history.length > 500) {
    db.history = db.history.slice(-500);
  }

  saveData();

  res.json({
    message: "Review recorded.",
    interval: card.interval,
    xp: db.xp,
    streak: db.streak
  });
});

app.get("/api/history", (req, res) => {
  res.json(db.history.slice().reverse());
});

app.get("/api/subjects", (req, res) => {
  res.json([...new Set(db.cards.map(card => card.subject))]);
});

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((req, res) => {
  res.status(404).json({ error: "Page not found." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("================================");
  console.log("🚀 RecallRocket is running!");
  console.log(`🌐 http://localhost:${PORT}`);
  console.log("================================");
});