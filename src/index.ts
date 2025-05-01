import express from "express";

const app = express();
const PORT = process.env.PORT ?? "9001";

app.get("/", (_, res) => {
    res.send("Hello World!!");
    console.log("Response sent!!");
});

app.listen(PORT, () => {
    console.log(`Running on PORT: ${PORT}`);
});
