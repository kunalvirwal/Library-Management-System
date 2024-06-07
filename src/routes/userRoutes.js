const express = require("express");
const router = express.Router();
const controllers = require("../controllers/userControllers")
const middleware = require("../utils/middlewares") 
require("dotenv").config();

// user dashboard route 
router.get("/user/dashboard",middleware.authenticate_token,middleware.authorize_user,middleware.isUser,(req,res)=>{
    controllers.getUserData(req,res);
});

// user jwt token updation route for role updation 
router.post("/user/refresh",middleware.authenticate_token,middleware.authorize_user,middleware.isUser,(req,res)=>{
    controllers.refreshToken(req,res);
});

module.exports = router;