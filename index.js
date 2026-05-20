const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
// 🎯 ObjectId ইম্পোর্ট করা হলো যাতে মঙ্গোডিবির নেটিভ _id ধরে কাজ করা যায় সেফলি
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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

    // 🎯 ৩. নির্দিষ্ট অ্যাপয়েন্টমেন্ট আপডেট করা (Update) -> আপনার দেওয়া লজিক অনুযায়ী ইমপ্লিমেন্ট করা হলো
    app.put('/appointments/:id', async (req, res) => {
      try {
        const id = req.params.id; // ইউআরএল থেকে ডাইনামিক আইডি নেওয়া হচ্ছে
        const updatedAppointment = req.body; // ফ্রন্টএন্ড থেকে পাঠানো নতুন ডেটা
        
        // মঙ্গোডিবির ইউনিক অবজেক্ট আইডি ম্যাচ করার ফিল্টার (এখানে id এবং _id দুইটার সেফটি রাখা হয়েছে)
        let filter = { $or: [{ id: id }, { id: id }] };
        
        // আইডিটি যদি মঙ্গোডিবির নেটিভ ObjectId ফরম্যাটের সাথে মিলে যায়, তবে সেটিকে ObjectId-তে রূপান্তর করে ফিল্টার করা হবে
        if (ObjectId.isValid(id)) {
          filter = { $or: [{ id: id }, { _id: new ObjectId(id) }] };
        }
        
        const options = { upsert: false }; // ডাটা না থাকলে নতুন করে তৈরি করার দরকার নেই
        
        // কোন কোন ফিল্ড আপডেট হবে তা সেট করা হচ্ছে
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

    // ডাটাবেেজ হেলথ চেক
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