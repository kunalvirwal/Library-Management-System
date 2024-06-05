const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const controllers = require("../controllers/maincontrollers")
const dbConn = require("../configs/database")
const bcrypt = require('bcrypt');
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

//create Admin middleware
async function createAdmin(req,ress,next){
    let result = await controllers.db_query("SELECT * FROM USER WHERE ROLE=?",["admin"])
    if (result.length==0){
        AdminPassword="A"
        AdminPassword= await controllers.saltNhash(AdminPassword)
        result = await controllers.db_query("INSERT INTO USER VALUES(1,'admin','admin@sdslabs.com','9999999999',?,'admin');",[AdminPassword])
        console.log("Created an Admin with email:admin@sdslabs.com and password A")
    }
    next()

}

//checks if admin
function isAdmin(req,res,next){
    if (req.user.role==="admin") next();
    else {
        return res.send("User not authorized, Can't access route!");
    }
}

//checks if user
function isUser(req,res,next){
    if (req.user.role==="user") next();
    else {
        return res.send("User not authorized, Can't access route!");
    }
    }

//sanitise a query
function sanitise(query){
    wrong_characters=["\'","\"","\`","--","="," ","(",")",",",];
    
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
router.get("/",createAdmin,authenticate_token,(req,res)=>{
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

//signup page route
router.get("/signup",(req,res)=>{
    res.render("signup.ejs");
})

router.post("/newUser",sanitiseEmail,(req,res)=>{
    if(sanitise(req.body.name)){
        controllers.newUser(req,res);
    } else  {
        res.send("Invallid username")
    }
    
})

// login request 
router.post("/login",sanitiseEmail,(req,res)=>{
    controllers.logging(req,res);
}); 

// common book catalog route
router.get("/books",authenticate_token,authorize_user,(req,res)=>{
    controllers.getBookCatalog(req,res);
});

// common book page route 
router.get("/books/:buid",authenticate_token,authorize_user,(req,res)=>{
    const parseid=parseInt(req.params.buid)
    if(isNaN(parseid)){
        return res.send("Incorrect route!")
    }
    controllers.getBookPage(req,res,req.params.buid);
});

// common checkin req route
router.post("/checkin",authenticate_token,authorize_user,(req,res)=>{
    controllers.makeCheckinReq(req,res);
});

// common checkout req route
router.post("/checkout",authenticate_token,authorize_user,(req,res)=>{
    controllers.makeCheckoutReq(req,res);
});

// common route for admin book request resloving and user seeing pending requests
router.get("/pending",authenticate_token,authorize_user,(req,res)=>{
    controllers.getPending(req,res);
});

// common user's admin convertion request and admin's request display template route
router.get("/cvt_admin",authenticate_token,authorize_user,(req,res)=>{
    controllers.getCvtAdmin(req,res);
})

// common admin convertion request creation route
router.post("/cvt_admin",authenticate_token,authorize_user,(req,res)=>{
    controllers.postCvtAdmin(req,res);
}) 

// admin convertion route operated by admin///////////////////////////////////  


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
    res.render("create_book.ejs");
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

// user dashboard route 
router.get("/user/dashboard",authenticate_token,authorize_user,isUser,(req,res)=>{
    controllers.getUserData(req,res);
});

// user jwt token updation route for role updation 
router.post("/user/refresh",authenticate_token,authorize_user,isUser,(req,res)=>{
    controllers.refresh_token(req,res);
});





module.exports = router;