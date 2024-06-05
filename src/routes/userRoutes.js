const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const controllers = require("../controllers/userControllers")
require("dotenv").config();


// decodes the token if present on each request 
function authenticate_token(req,res,next){    
    const cookies= req.cookies;
    if (cookies && cookies.token){
        try{
            const payload=jwt.verify(cookies.token,process.env.SECRET_KEY);   
            req.user=payload.data;
        } catch(err){
            return res.send("Invalid JWT token");
        }

    }
    else{
        req.user=undefined;
    }
    next();
}

// verifies the jwt payload
function authorize_user(req,res,next){
    if (req.user && req.user.uuid && req.user.email && req.user.role && req.user.name){
        next();
    }
    else{
        return res.send("User not authenticated, Can't access route!");
    }
}

//checks if user
function isUser(req,res,next){
    if (req.user.role==="user") next();
    else {
        return res.send("User not authorized, Can't access route!");
    }
}

// user dashboard route 
router.get("/user/dashboard",authenticate_token,authorize_user,isUser,(req,res)=>{
    controllers.getUserData(req,res);
});

// user jwt token updation route for role updation 
router.post("/user/refresh",authenticate_token,authorize_user,isUser,(req,res)=>{
    controllers.refreshToken(req,res);
});

module.exports = router;