const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const controllers = require("../controllers/adminControllers")
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

//checks if admin
function isAdmin(req,res,next){
    if (req.user.role==="admin") next();
    else {
        return res.send("User not authorized, Can't access route!");
    }
}

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
    const parseid=parseInt(req.params.buid);
    if(isNaN(parseid)){
        return res.send("Incorrect route!");
    }
    controllers.saveBookEditChanges(req,res,parseid);
})
// create a new book route
router.get("/admin/addbook",authenticate_token,authorize_user,isAdmin,(req,res)=>{
    res.render("createBook.ejs");
})

// admin create book logic route
router.post("/admin/addbook",authenticate_token,authorize_user,isAdmin,(req,res)=>{
    controllers.newBook(req,res);
})

// delete book route
router.get("/admin/deletebook/:buid",authenticate_token,authorize_user,isAdmin,(req,res)=>{
    const parseid=parseInt(req.params.buid);
    if(isNaN(parseid)){
        return res.send("Incorrect route!");
    }
    controllers.deleteBook(req,res,parseid);
})

// common approve link but operated by admin
router.get("/admin/approve/:uuid/:buid",authenticate_token,authorize_user,isAdmin,(req,res)=>{
    const parsebuid=parseInt(req.params.buid);
    const parseuuid=parseInt(req.params.uuid);

    if(isNaN(parsebuid) || isNaN(parseuuid)){
        return res.send("Incorrect route!");
    }
    controllers.approve(req,res,parseuuid,parsebuid);
});

// common deny link but operated by admin
router.get("/admin/deny/:uuid/:buid",authenticate_token,authorize_user,isAdmin,(req,res)=>{
    const parsebuid=parseInt(req.params.buid);
    const parseuuid=parseInt(req.params.uuid);
    
    if(isNaN(parsebuid) || isNaN(parseuuid)){
        return res.send("Incorrect route!");
    }
    controllers.deny(req,res,parseuuid,parsebuid);
});

module.exports = router;