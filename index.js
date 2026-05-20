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

    // 🎯 ৩. নির্দিষ্ট ইউজারের প্রোফাইল আপডেট করা (Update) -> এখানে নতুন মেথডটি বসানো হয়েছে
    app.put('/users/:email', async (req, res) => {
      try {
        const email = req.params.email; // ইমেইল বা আইডি দিয়ে সহজে ইউজার ট্র্যাক করার জন্য
        const updatedUser = req.body;
        
        // Better-Auth এর ইমেইল, কাস্টম uid অথবা মঙ্গোডিবির নেটিভ অবজেক্ট আইডি সবকিছুর জন্যই সেফটি ফিল্টার
        let filter = { $or: [{ email: email }, { uid: email }] };
        if (ObjectId.isValid(email)) {
          filter = { $or: [{ email: email }, { _id: new ObjectId(email) }] };
        }

        const options = { upsert: true }; // 💡 ট্রিক: ইউজার যদি আগে থেকে ডাটাবেজে না থাকে, তবে সে নতুন প্রোফাইল তৈরি করে নেবে (Upsert: true)

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