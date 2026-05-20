const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config(); 

const app = express();
// 🎯 পোর্ট সেফটি ব্যাকআপ (৫০০০ পোর্টে রান হবে যদি .env মিসিং থাকে)
const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

// 🔒 মিডলওয়্যার কনফিগারেশন
app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: true
}));
app.use(express.json());

// মঙ্গোডিবি ক্লায়েন্ট সেটআপ
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    console.log("🍃 MongoDB Connected Successfully!");

    const database = client.db('doctors_portal');
    const doctorsCollection = database.collection('doctors');
    const usersCollection = database.collection('users');
    const appointmentsCollection = database.collection('appointments');
    
    // ================= 🩺 DOCTORS APIS =================
    app.get('/doctors', async (req, res) => {
      const cursor = doctorsCollection.find({});
      const doctors = await cursor.toArray();
      res.json(doctors);
    }); 
    
    // ================= 📅 APPOINTMENTS APIS =================
    app.post('/appointments', async (req, res) => {
      const appointment = req.body;
      const result = await appointmentsCollection.insertOne(appointment);
      res.json(result);
    });

    app.get('/appointments', async (req, res) => {
      const cursor = appointmentsCollection.find({});
      const appointments = await cursor.toArray();
      res.json(appointments);
    });

    // ================= 👤 PATIENT USERS APIS =================
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    app.get('/users', async (req, res) => {
      const cursor = usersCollection.find({});
      const users = await cursor.toArray();
      res.json(users);
    });

    // ডাটাবেজ হেলথ চেক
    await client.db("admin").command({ ping: 1 });
    console.log("🎯 Pinged your deployment. Connected to MongoDB!");

  } catch (error) {
    console.error("❌ Database connection error:", error.message);
  }
}
run().catch(console.dir);

// রুট টেস্ট রাউট
app.get('/', (req, res) => {
  res.send('Hello, Doctor Server is running!');
});

// সার্ভার লিসেন
app.listen(PORT, () => {
  console.log(`🏥 Server is running on port ${PORT}`);
});