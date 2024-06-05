const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const controllers = require("../controllers/commonControllers")
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

//create Admin middleware
async function createAdmin(req,res,next){
    let result = await controllers.dbQuery("SELECT * FROM USER WHERE ROLE=?",["admin"])
    if (result.length==0){
        AdminPassword="A"
        AdminPassword= await controllers.saltNhash(AdminPassword)
        result = await controllers.dbQuery("INSERT INTO USER VALUES(1,'admin','admin@sdslabs.com','9999999999',?,'admin');",[AdminPassword])
        console.log("Created an Admin with email:admin@sdslabs.com and password A")
    }
    next()

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

module.exports = router;