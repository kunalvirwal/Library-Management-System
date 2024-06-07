const express = require("express");
const router = express.Router();
const controllers = require("../controllers/commonControllers")
const middleware = require("../utils/middlewares") 
require("dotenv").config();

// login page route
router.get("/",middleware.createAdmin,(req,res)=>{
    if (req.user){
        
        if (req.user.role==="admin"){ 
            return res.redirect("/admin/dashboard");
        }
        if(req.user.role==="user"){
            return res.redirect("/user/dashboard");
        }
    }
    data={tried:false}
    res.render("login.ejs",data);
});

//signup page route
router.get("/signup",(req,res)=>{
    res.render("signup.ejs",{exists:false});
})

router.post("/newUser",middleware.sanitiseEmail,(req,res)=>{
    if(middleware.sanitise(req.body.name)){
        controllers.newUser(req,res);
    } else  {
        res.status(400).redirect("/signup")
    }
    
})

// login request 
router.post("/login",middleware.sanitiseEmail,(req,res)=>{
    controllers.logging(req,res);
}); 

// common book catalog route
router.get("/books",(req,res)=>{
    controllers.getBookCatalog(req,res);
});

// account details edit page route
router.get("/account",(req,res)=>{
    controllers.account(req,res);
});

// account details edit logic
router.post("/account",(req,res)=>{
    controllers.editAccount(req,res);
});

// common book page route 
router.get("/books/:buid",(req,res)=>{
    const parseid=parseInt(req.params.buid)
    if(isNaN(parseid)){
        return res.status(400).redirect("/books")
    }
    controllers.getBookPage(req,res,req.params.buid);
});

// common checkin req route
router.post("/checkin",(req,res)=>{
    controllers.makeCheckinReq(req,res);
});

// common checkout req route
router.post("/checkout",(req,res)=>{
    controllers.makeCheckoutReq(req,res);
});

// common route for admin book request resloving and user seeing pending requests
router.get("/pending",(req,res)=>{
    controllers.getPending(req,res);
});

// common user's admin convertion request and admin's request display template route
router.get("/cvt_admin",(req,res)=>{
    controllers.getCvtAdmin(req,res);
})

// common admin convertion request creation route
router.post("/cvt_admin",(req,res)=>{
    controllers.postCvtAdmin(req,res);
}) 

//common logout route
router.get("/logout",(req,res)=>{
    res.clearCookie("token");
    res.redirect("/")
})

module.exports = router;