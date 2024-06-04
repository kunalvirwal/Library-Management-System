const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const controllers = require("../controllers/maincontrollers")
require("dotenv").config();

db=[
    {
        uuid:1,
        name:"Kunal",
        email:"k@k",
        phn_no:1234567890,
        password:"K",
        role:"user"
    },
    {
        uuid:2,
        name:"admin",
        email:"a@a",
        phn_no:1234567890,
        password:"A",
        role:"admin"
    }
];

// decodes the token if present on each request 
function authenticate_token(req,res,next){    
    const cookies= req.cookies;
    if (cookies && cookies.token){
        // token found
        // console.log(process.env.SECRET_KEY)
        try{
            const payload=jwt.verify(cookies.token,process.env.SECRET_KEY);

            req.user=payload.data;
            // console.log(payload)
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

//checks if admin
function isAdmin(req,res,next){
    if (req.user.role==="admin") next()
    else {
        return res.send("User not authorized, Can't access route!");
    }
}

//checks if user
function isUser(req,res,next){
    if (req.user.role==="user") next()
    else {
        return res.send("User not authorized, Can't access route!");
    }
}

//sanitise a query
function sanitise(query){
    wrong_characters=["\'","\"","\`","--","having","where","="," ","(",")",",",];
    
    wrong_characters.forEach((val) => {
        if (query.includes(val)){
            return false;
        } 
    });

    return true;
}

//sql injection sanition
function sanitiseEmail(req,res,next){
    req.body.email=req.body.email.trim().toLowerCase();
    parts=req.body.email.split("@")
    let valid=true;
    if (parts.length==2){
        valid=sanitise(parts[1]);
    }
    else{
        valid=false;
    }

    if (valid){
        next();
    }
    else{
        res.send("Wrong input details, can't login")
    }
}





// login page route
router.get("/",authenticate_token,(req,res)=>{
    if (req.user){
            // console.log(req.user)
        if (req.user.role==="admin"){ 
            return res.redirect("/admin/dashboard");
        }
        if(req.user.role==="user"){
            return res.redirect("/user/dashboard");
        }
    }
    res.render("login.ejs");
});

// login request 
router.post("/login",sanitiseEmail,(req,res)=>{
    controllers.logging(req,res);
}); 

// common book catalog route
router.get("/books",authenticate_token,authorize_user,(req,res)=>{
    controllers.getBookCatalog(req,res);
});

router.get("/books/:buid",authenticate_token,authorize_user,(req,res)=>{
    const parseid=parseInt(req.params.buid)
    if(isNaN(parseid)){
        return res.send("Incorrect route!")
    }
    controllers.getBookPage(req,res,req.params.buid);
});



//admin dashboard route
router.get("/admin/dashboard",authenticate_token,authorize_user,isAdmin,(req,res)=>{
    controllers.getAdminDashData(req,res);
});

//admin edit book route
router.get("/admin/editbook/:buid",authenticate_token,authorize_user,isAdmin,(req,res)=>{
    const parseid=parseInt(req.params.buid)
    if(isNaN(parseid)){
        return res.send("Incorrect route!")
    }
    controllers.editBook(req,res,parseid);
});

// admin edit book save changes route
router.post("/admin/editbook/:buid",authenticate_token,authorize_user,isAdmin,(req,res)=>{
    const parseid=parseInt(req.params.buid)
    if(isNaN(parseid)){
        return res.send("Incorrect route!")
    }
    controllers.saveBookEditChanges(req,res,parseid);
})

// user dashboard route //////////////////////////////////////////////////
router.get("/user/dashboard",authenticate_token,authorize_user,isUser,(req,res)=>{
    res.send("Welcome to dashboard");
});



module.exports = router;