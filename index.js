import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./routes/index.js";

const app = express();

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api-v1", routes);

app.get("/api", (req, res) => {
  res.send("Server is Live!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
