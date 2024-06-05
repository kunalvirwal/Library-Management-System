const express = require("express");
const path = require("path");
const app = express() ;
const cookieParser = require("cookie-parser")
require("dotenv").config();
const PORT= process.env.PORT || 5000;


app.set("view engine","ejs");
app.set("views", path.resolve("./src/views"));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));


app.use("",require("./routes/routes"));

app.listen(PORT,(error) => {
    if(!error) console.log("Yeah! The server is running!"); 

    else console.log("Error occurred, server can't start", error); 
})
