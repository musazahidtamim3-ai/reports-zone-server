import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";
import { ObjectId } from "mongodb";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI as string, {
     serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
     },
});

async function startServer() {
     await client.connect();
     console.log("MongoDB Connected");

     const db = client.db(process.env.DB_NAME);
     const usersCollection = db.collection("users");
     const reportsCollection = db.collection("reports");

     app.get("/", (req: Request, res: Response) => {
          res.send("Reports Zone Server is Running...");
     });

     // Save User
     app.post("/api/users", async (req: Request, res: Response) => {
          try {
               const user = req.body;
               const result = await usersCollection.insertOne(user);
               res.status(201).send(result);
          } catch (error) {
               console.error(error);
               res.status(500).send({ message: "Something went wrong" });
          }
     });

     // Get Users
     app.get("/api/users", async (req: Request, res: Response) => {
          try {
               const users = await usersCollection.find().toArray();
               res.send(users);
          } catch (error) {
               console.error(error);
               res.status(500).send({ message: "Something went wrong" });
          }
     });

     app.get("/api/reports/top-contributors", async (req: Request, res: Response) => {
          try {
               const topContributors = await reportsCollection
                    .aggregate([
                         {
                              $group: {
                                   _id: "$creatorId",
                                   name: { $first: "$creatorName" },
                                   image: { $first: "$creatorPhoto" },
                                   reportCount: { $sum: 1 },
                              },
                         },
                         { $sort: { reportCount: -1 } },
                         { $limit: 4 },
                    ])
                    .toArray();

               res.send(topContributors);
          } catch (error) {
               console.error(error);
               res.status(500).send({ message: "Something went wrong" });
          }
     });

     app.post("/api/reports", async (req: Request, res: Response) => {
          try {
               const report = req.body; 
               const result = await reportsCollection.insertOne({
                    ...report,
                    createdAt: new Date(),
               });
               res.status(201).send(result);
          } catch (error) {
               console.error(error);
               res.status(500).send({ message: "Something went wrong" });
          }
     });

     app.get("/api/reports", async (req: Request, res: Response) => {
          try {
               const reports = await reportsCollection.find().toArray();
               res.send(reports);
          } catch (error) {
               console.error(error);
               res.status(500).send({ message: "Something went wrong" });
          }
     });

     app.get("/api/reports/:userId", async (req: Request, res: Response) => {
          try {
               const query = { creatorId: req.params.userId };
               const reports = await reportsCollection.find(query).toArray();
               res.send(reports);
          } catch (error) {
               console.error(error);
               res.status(500).send({ message: "Something went wrong" });
          }
     });  

     

     app.delete("/api/reports/:id", async (req: Request, res: Response) => {
          try {
               const { id } = req.params;
               const reportId = id as string;

               if (!ObjectId.isValid(reportId)) {
                    return res.status(400).send({ message: "Invalid report ID" });
               }

               const result = await reportsCollection.deleteOne({ _id: new ObjectId(reportId) });

               if (result.deletedCount === 0) {
                    return res.status(404).send({ message: "Report not found" });
               }

               res.send({ message: "Report deleted successfully" });
          } catch (error) {
               console.error(error);
               res.status(500).send({ message: "Something went wrong" });
          }
     });

     app.get("/api/reports/:userId/weekly-stats", async (req: Request, res: Response) => {
          try {
               const { userId } = req.params;

               const sevenDaysAgo = new Date();
               sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
               sevenDaysAgo.setHours(0, 0, 0, 0);

               const dailyStats = await reportsCollection
                    .aggregate([
                         {
                              $match: {
                                   creatorId: userId,
                                   createdAt: { $gte: sevenDaysAgo },
                              },
                         },
                         {
                              $group: {
                                   _id: {
                                        year: { $year: "$createdAt" },
                                        month: { $month: "$createdAt" },
                                        day: { $dayOfMonth: "$createdAt" },
                                   },
                                   reports: { $sum: 1 },
                              },
                         },
                         { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
                    ])
                    .toArray();

               res.send(dailyStats);
          } catch (error) {
               console.error(error);
               res.status(500).send({ message: "Something went wrong" });
          }
     });

     app.listen(port, () => {
          console.log(` Server Running on http://localhost:${port}`);
     });
}

startServer();