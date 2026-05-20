const dns = require("node:dns");
dns.setServers(["8.8.8.8","8.8.4.4"]);

const express = require('express');
const dotenv = require('dotenv');
dotenv.config(); 
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGODB_URI;


const app = express();
const PORT = process.env.PORT;
const cors = require('cors');
// const { MongoClient, ServerApiVersion } = require('mongodb');
// require('dotenv').config();
app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: true
}));
app.use(express.json());


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

    const database = client.db('doctors_portal');
    // const usersCollection = database.collection('users');
    const appointmentsCollection = database.collection('appointments');
    
    app.post('/appointments', async (req, res) => {
      const appointment = req.body;
      console.log(appointment);
      const result = await appointmentsCollection.insertOne(appointment);
      res.json(result);
    });



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello, Doctor Server is running!');
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});