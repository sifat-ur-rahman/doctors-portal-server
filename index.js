const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

const app = express();

app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sb5ycdx.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next){
    
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send('unauthorized access')
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
        next();
    })
}

async function run(){
    try{
        const appointmentOptionsCollection = client.db('doctorsPortal').collection('appointmentOptions') 

        const bookingsCollection = client.db('doctorsPortal').collection('bookings')

        const usersCollection = client.db('doctorsPortal').collection('users')
        const doctorCollection = client.db('doctorsPortal').collection('doctors')

        app.get('/appointmentOptions',  async(req, res) =>{
            const date = req.query.date
            const query = {}
            const options = await appointmentOptionsCollection.find(query).toArray()
            const bookingQuery = {appointmentDate: date}
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
                const bookedSlots = optionBooked.map(book => book.slot)
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots
            })
            res.send(options)
        })

        app.get('/appointmentSpecialty', async(req,res)=>{
            const query = {}
            const result = await appointmentOptionsCollection.find(query).project({name: 1}).toArray()
            res.send(result)
        })


        app.get('/bookings', verifyJWT, async(req, res) =>{
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if(email !== decodedEmail){
                return res.status(403).send({message: 'forbidden access'})
            }

            const query = {email: email}
            const booking = await bookingsCollection.find(query).toArray()
            res.send(booking)
        })


        app.post('/bookings', async(req, res) =>{
            const booking = req.body 
            console.log(booking);
            const query ={
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment
            }

            const alreadyBooked = await bookingsCollection.find(query).toArray()

            if(alreadyBooked.length){
                const message = `You already have a booking on ${booking.appointmentDate} `
                return res.send({acknowledged: false, message})
            }

            const result = await bookingsCollection.insertOne(booking);
            res.send(result)
        })

        app.get('/jwt', async(req, res)=>{
            const email = req.query.email
            const query = {email: email}
            const user = await usersCollection.findOne(query)
            if(user){
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '12h'})
                return res.send({accessToken: token})
            }
            
            res.status(403).send({accessToken: ''})
        })

        app.get('/users', async(req, res)=>{
            const query = {}
            const users = await usersCollection.find(query).toArray()
            res.send(users)
        })
        app.get('/users/admin/:email', async(req, res) =>{
            const email = req.params.email
            const query = {email}
            const user = await usersCollection.findOne(query)
            res.send({isAdmin: user?.rol === 'admin'})
        })


        app.post('/users', async(req, res)=>{
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.put('/users/admin/:id', verifyJWT, async(req,res) =>{
            const decodedEmail = req.decoded.email;
            const query = {email: decodedEmail}
            const user = await usersCollection.findOne(query)

            if(user?.rol !== 'admin'){
                return res.status(403).send({message: 'forbidden access'})
            }
            const id = req.params.id
            const filter = {_id: ObjectId(id)}
            const options = {upsert: true}
            const updatedDoc = {
                $set: {
                    rol:'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc,options)
            res.send(result)
        });

        app.get('/doctors', async(req, res) =>{
            const query = {}
            const doctors = await doctorCollection.find(query).toArray()
            res.send(doctors);
        })

        app.post('/doctors', async(req, res) =>{
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor)
            res.send(result)
        })
    }

    finally{

    }
}
run().catch(console.log)


app.get('/', async(req, res) =>{
    res.send('Doctor portal server is running')
})

app.listen(port, () => console.log(`Doctor portal running on ${port}`))