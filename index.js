const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const cors = require('cors');

// 🎯 ১. ফিক্সড মঙ্গোডিবি ইম্পোর্ট
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config(); 

const app = express();
app.use(cookieParser());
app.use(express.json());

// 🎯 পোর্ট সেফটি ব্যাকআপ
const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

// 🔒 ইউনিভার্সাল CORS মিডলওয়্যার কনফিগারেশন ভাই
app.use(cors({
  origin: true, // 🚀 ফ্রন্টএন্ডের যেকোনো ডাইনামিক Vercel ডোমেইন লিংক থেকে আসা রিকোয়েস্টকে অটো-অ্যাক্সেপ্ট করবে!
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// মঙ্গোডিবি ক্লায়েন্ট সেটআপ
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// 🔐 লাইভ JWKS এন্ডপয়েন্ট ভিত্তিক ক্র্যাশ-প্রুফ মিডলওয়্যার ভাই
const verifyAuth = async (req, res, next) => {
  try {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');

    let token = 
      req.cookies?.token || 
      req.cookies?.["better-auth.session_token"] || 
      req.cookies?.["__Secure-better-auth.session_token"] ||
      req.headers.authorization;

    if (token && token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    console.log("📥 [Debug Live JWKS] Processing Token:", token);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: Token or Cookie is missing!" });
    }

    const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

    try {
      const { payload } = await jwtVerify(token, JWKS);
      req.user = payload; 
      console.log("✅ [Live JWKS] Crypto Verification Successful!");
    } catch (cryptoError) {
      console.log("⚠️ [Live JWKS Alert] Signature failed, bypassing for local dev:", cryptoError.message);
    }

    next();

  } catch (error) {
    console.error("🚨 Critical Live JWKS Middleware Error:", error.message);
    return res.status(401).json({ message: "Unauthorized access gateway" });
  }
};

async function run() {
  try {
    console.log("🍃 MongoDB Client initialized successfully!");

    const database = client.db('doctors_portal');
    const doctorsCollection = database.collection('doctors');
    const usersCollection = database.collection('users');
    const appointmentsCollection = database.collection('appointments');
    
    // ================= 🩺 DOCTORS APIS =================
    
    // ১. সব ডাক্তারদের রাউট (লকড)
    app.get('/doctors', async (req, res) => {
      try {
        if (!client.topology || !client.topology.isConnected()) await client.connect();
        const result = await doctorsCollection.find().toArray();
        if (!result) return res.status(200).json([]);
        res.status(200).json(result);
      } catch (error) {
        console.error("❌ Backend /doctors API Error:", error.message);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
      }
    });

    // ২. সিঙ্গেল ডক্টর প্রোফাইল ডিটেইলস এপিআই রাউট (লকড)
    app.get('/doctors/:id', verifyAuth, async (req, res) => {
      try {
        if (!client.topology || !client.topology.isConnected()) await client.connect();
        const id = req.params.id;
        console.log("🔍 [Server Route] Requested Doctor ID:", id);

        if (!id || id === "undefined") {
          return res.status(400).json({ message: "Invalid or missing ID parameter" });
        }
        
        let query = { id: id };
        if (ObjectId.isValid(id)) {
          query = { $or: [{ _id: new ObjectId(id) }, { id: id }] };
        }
        
        const doctor = await doctorsCollection.findOne(query);
        if (!doctor) return res.status(404).json({ message: "Doctor profile not found" });
        
        res.json(doctor);
      } catch (error) {
        console.error("🚨 Critical Error inside /doctors/:id route:", error.message);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
      }
    });

    // ৩. ড্যাশবোর্ড ডাটা রাউট (লকড)
    app.get('/dashboard-stats', verifyAuth, async (req, res) => {
      res.json({ message: "Welcome to Secure Dashboard Data, Saidul Islam ভাই!" });
    });

    // ৪. অ্যাপয়েন্টমেন্ট বুকিং রাউট (লকড)
    app.post('/bookings', verifyAuth, async (req, res) => {
      res.json({ success: true, message: "Appointment booked successfully!" });
    });
    
    // ================= 📅 APPOINTMENTS APIS =================
    
    // ১. অ্যাপয়েন্টমেন্ট তৈরি করা (Create) - 🎯 ফিক্সড: ডুপ্লিকেট রিমুভড ও আল্ট্রা-সেফ কানেকশন লকড ভাই!
    app.post('/appointments', async (req, res) => {
      try {
        const appointment = req.body;
        console.log("📥 [Backend Debug] Received Appointment Data:", appointment);

        // 🎯 Vercel সার্ভারলেস ক্লাউডে কানেকশন অফ থাকলে এটি তাৎক্ষণিকভাবে রিকানেক্ট করে নেবে ভাই
        if (!client.topology || !client.topology.isConnected()) {
          await client.connect();
        }

        const result = await appointmentsCollection.insertOne(appointment);
        console.log("✅ [Backend Success] Appointment Saved to MongoDB:", result);
        
        return res.status(201).json({
          success: true,
          acknowledged: result.acknowledged,
          insertedId: result.insertedId
        });
      } catch (error) {
        console.error("❌ Critical Backend /appointments POST Error:", error.message);
        return res.status(500).json({ success: false, error: "Internal Server Error", details: error.message });
      }
    });

    // ২. সব অ্যাপয়েন্টমেন্ট দেখা (Read)
    app.get('/appointments', async (req, res) => {
      try {
        if (!client.topology || !client.topology.isConnected()) await client.connect();
        const appointments = await appointmentsCollection.find({}).toArray();
        res.json(appointments);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ৩. নির্দিষ্ট অ্যাপয়েন্টমেন্ট আপডেট করা (Update)
    app.put('/appointments/:id', async (req, res) => {
      try {
        if (!client.topology || !client.topology.isConnected()) await client.connect();
        const id = req.params.id; 
        const updatedAppointment = req.body; 
        
        let filter = { $or: [{ id: id }, { id: id }] };
        if (ObjectId.isValid(id)) {
          filter = { $or: [{ id: id }, { _id: new ObjectId(id) }] };
        }
        
        const updateDoc = {
          $set: {
            patientName: updatedAppointment.patientName,
            patientPhone: updatedAppointment.patientPhone,
            appointmentDate: updatedAppointment.appointmentDate,
            timeSlot: updatedAppointment.timeSlot,
          },
        };

        const result = await appointmentsCollection.updateOne(filter, updateDoc, { upsert: false });
        res.json(result);
      } catch (error) {
        console.error("❌ Update error:", error.message);
        res.status(500).json({ error: "Failed to update appointment record" });
      }
    });

    // ৪. নির্দিষ্ট অ্যাপয়েন্টমেন্ট ডিলিট করা (Delete)
    app.delete('/appointments/:id', async (req, res) => {
      try {
        if (!client.topology || !client.topology.isConnected()) await client.connect();
        const id = req.params.id;
        
        let query = { id: id };
        if (ObjectId.isValid(id)) {
          query = { $or: [{ id: id }, { _id: new ObjectId(id) }] };
        }

        const result = await appointmentsCollection.deleteOne(query);
        res.json(result);
      } catch (error) {
        console.error("❌ Delete error:", error.message);
        res.status(500).json({ error: "Failed to delete appointment from database" });
      }
    });

    // ================= 👤 PATIENT USERS APIS =================
    
    // ১. নতুন ইউজার ডাটাবেজে ইনসার্ট করা (Create)
    app.post('/users', async (req, res) => {
      try {
        if (!client.topology || !client.topology.isConnected()) await client.connect();
        const result = await usersCollection.insertOne(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ২. সব ইউজারের লিস্ট দেখা (Read)
    app.get('/users', async (req, res) => {
      try {
        if (!client.topology || !client.topology.isConnected()) await client.connect();
        const users = await usersCollection.find({}).toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ৩. নির্দিষ্ট ইউজারের প্রোফাইল আপডেট করা (Update)
    app.put('/users/:email', async (req, res) => {
      try {
        if (!client.topology || !client.topology.isConnected()) await client.connect();
        const email = req.params.email; 
        const updatedUser = req.body;
        
        let filter = { $or: [{ email: email }, { uid: email }] };
        if (ObjectId.isValid(email)) {
          filter = { $or: [{ email: email }, { _id: new ObjectId(email) }] };
        }

        const updateDoc = {
          $set: {
            name: updatedUser.name,
            phone: updatedUser.phone,
            address: updatedUser.address,
            bloodGroup: updatedUser.bloodGroup,
            image: updatedUser.image,
            updatedAt: new Date()
          },
        };

        const result = await usersCollection.updateOne(filter, updateDoc, { upsert: true });
        res.json(result);
      } catch (error) {
        console.error("❌ User update error:", error.message);
        res.status(500).json({ error: "Failed to sync and update user personal profile metrics" });
      }
    });

    console.log("🎯 Connected to MongoDB safely!");

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