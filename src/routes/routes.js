const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
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

function generate_jwt(user){
    // jwt payload
    data={
        uuid : user.uuid,
        email : user.email,
        name : user.name,
        role : user.role
    };  
    // console.log(data)
    return jwt.sign({data},process.env.SECRET_KEY,{expiresIn:"1d"});
}


// login page route
router.get("/",authenticate_token,(req,res)=>{
    if (req.user){
            console.log(req.user)
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
router.post("/login",(req,res)=>{
    // console.log(req.body) ;

    //////////////////////////////////////////////////////////////////////////hash to compair incoming password
    for(let i of db){  ///////////////////////////////////////use the real db\
        console.log(i.email,"\t",req.body.email)
        if (i.email===req.body.email){
            user=i;
            
            break;
        }
    }

    console.log(user)
    const token=generate_jwt(user);
    res.cookie("token",token,{httpOnly:true});
    res.redirect("/");
}); 




router.get("/user/dashboard",authenticate_token,authorize_user,isUser,(req,res)=>{
    res.send("Welcome to dashboard");
})

router.get("/admin/dashboard",authenticate_token,authorize_user,isAdmin,(req,res)=>{
    res.send("Welcome to dashboard");
})


module.exports = router;