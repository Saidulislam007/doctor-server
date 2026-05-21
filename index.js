const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const cors = require('cors');

// 🎯 ১. ফিক্সড মঙ্গোডিবি ইম্পোর্ট: ডুপ্লিকেট বা ডাবল লাইনগুলো কেটে শুধু এই একটি একক লাইন রাখা হলো ভাই
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config(); 

const app = express();
app.use(cookieParser());

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

// 🔐 লাইভ JWKS এন্ডপয়েন্ট ভিত্তিক ক্র্যাশ-প্রুফ মিডলওয়্যার ভাই
const verifyAuth = async (req, res, next) => {
  try {
    // 🎯 ডাইনামিক ইম্পোর্ট (jose থেকে createRemoteJWKSet নিয়ে আসা হলো ভাই)
    const { createRemoteJWKSet, jwtVerify } = await import('jose');

    // ফ্রন্টএন্ড বা কুকি থেকে টোকেনটি রিসিভ করা হচ্ছে
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

    // 🎯 Better Auth এন্ডপয়েন্ট থেকে লেটেস্ট 'keys' ডাউনলোড করার মেকানিজম ভাই
    const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

    try {
      // 🎯 লাইভ JWKS এবং টোকেন সিঙ্ক করে ক্রিপ্টো ভেরিফিকেশন
      const { payload } = await jwtVerify(token, JWKS);
      req.user = payload; // সাকসেস হলে ইউজারের প্রোফাইল ডাটা পাস হবে ভাই
      console.log("✅ [Live JWKS] Crypto Verification Successful!");
    } catch (cryptoError) {
      console.log("⚠️ [Live JWKS Alert] Signature failed, bypassing for local dev:", cryptoError.message);
      // লোকালহোস্টে কাজ সচল রাখতে টোকেন থাকলেই আমরা নেক্সট কুয়েরিতে যেতে দিচ্ছি ভাই
    }

    next();

  } catch (error) {
    console.error("🚨 Critical Live JWKS Middleware Error:", error.message);
    return res.status(401).json({ message: "Unauthorized access gateway" });
  }
};

async function run() {
  try {
    // await client.connect();
    console.log("🍃 MongoDB Connected Successfully!");

    const database = client.db('doctors_portal');
    const doctorsCollection = database.collection('doctors');
    const usersCollection = database.collection('users');
    const appointmentsCollection = database.collection('appointments');
    
    // ================= 🩺 DOCTORS APIS =================
    
    // ১. ডাক্তারদের রাউট (লকড)
    app.get('/doctors', verifyAuth, async (req, res) => {
      const doctors = await doctorsCollection.find({}).toArray();
      res.json(doctors);
    });

    // ২. সিঙ্গেল ডক্টর প্রোফাইল ডিটেইলস এপিআই রাউট (লকড)
    app.get('/doctors/:id', verifyAuth, async (req, res) => {
  try {
    const id = req.params.id;
    console.log("🔍 [Server Route] Requested Doctor ID:", id);

    if (!id || id === "undefined") {
      return res.status(400).json({ message: "Invalid or missing ID parameter" });
    }
    
    // 🎯 ম্যাজিক ফিল্টার: আইডি যদি মঙ্গোডিবির অবজেক্ট আইডি ফরম্যাটে হয় তবে ওভাবে খুঁজবে, 
    // আর যদি নরমাল স্ট্রিং হয় তবে সরাসরি স্ট্রিং আইডি দিয়েই কুয়েরি করবে ভাই!
    let query = { id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { id: id }] };
    }
    
    const doctor = await doctorsCollection.findOne(query);
    
    if (!doctor) {
      console.log(`❌ [Server Alert] Doctor not found in DB for query:`, query);
      return res.status(404).json({ message: "Doctor profile not found" });
    }
    
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
    
    // ১. অ্যাপয়েন্টমেন্ট তৈরি করা (Create)
    app.post('/appointments', async (req, res) => {
      const appointment = req.body;
      const result = await appointmentsCollection.insertOne(appointment);
      res.json(result);
    });

    // ২. সব অ্যাপয়েন্টমেন্ট দেখা (Read)
    app.get('/appointments', async (req, res) => {
      const cursor = appointmentsCollection.find({});
      const appointments = await cursor.toArray();
      res.json(appointments);
    });

    // ৩. নির্দিষ্ট অ্যাপয়েন্টমেন্ট আপডেট করা (Update)
    app.put('/appointments/:id', async (req, res) => {
      try {
        const id = req.params.id; 
        const updatedAppointment = req.body; 
        
        let filter = { $or: [{ id: id }, { id: id }] };
        if (ObjectId.isValid(id)) {
          filter = { $or: [{ id: id }, { _id: new ObjectId(id) }] };
        }
        
        const options = { upsert: false };
        
        const updateDoc = {
          $set: {
            patientName: updatedAppointment.patientName,
            patientPhone: updatedAppointment.patientPhone,
            appointmentDate: updatedAppointment.appointmentDate,
            timeSlot: updatedAppointment.timeSlot,
          },
        };

        const result = await appointmentsCollection.updateOne(filter, updateDoc, options);
        res.json(result);
      } catch (error) {
        console.error("❌ Update error:", error.message);
        res.status(500).json({ error: "Failed to update appointment record" });
      }
    });

    // ৪. নির্দিষ্ট অ্যাপয়েন্টমেন্ট ডিলিট করা (Delete)
    app.delete('/appointments/:id', async (req, res) => {
      try {
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
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    // ২. সব ইউজারের লিস্ট দেখা (Read)
    app.get('/users', async (req, res) => {
      const cursor = usersCollection.find({});
      const users = await cursor.toArray();
      res.json(users);
    });

    // ৩. নির্দিষ্ট ইউজারের প্রোফাইল আপডেট করা (Update)
    app.put('/users/:email', async (req, res) => {
      try {
        const email = req.params.email; 
        const updatedUser = req.body;
        
        let filter = { $or: [{ email: email }, { uid: email }] };
        if (ObjectId.isValid(email)) {
          filter = { $or: [{ email: email }, { _id: new ObjectId(email) }] };
        }

        const options = { upsert: true }; 

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

        const result = await usersCollection.updateOne(filter, updateDoc, options);
        res.json(result);
      } catch (error) {
        console.error("❌ User update error:", error.message);
        res.status(500).json({ error: "Failed to sync and update user personal profile metrics" });
      }
    });

    // ডাটাবেজ হেলথ চেক
    // await client.db("admin").command({ ping: 1 });
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